const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { supabase, importExcel } = require('./database');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        message: 'Serveur Gestion Personnel Enseignant (Supabase) opérationnel',
        endpoints: {
            teachers: '/api/teachers',
            stats: '/api/stats'
        }
    });
});

// Helper pour le journal d'audit
async function createAuditLog(adminEmail, action, targetId, details) {
    try {
        await supabase.from('audit_logs').insert([{
            admin_email: adminEmail,
            action,
            target_id: targetId,
            details
        }]);
    } catch (e) { console.error('Erreur Audit Log:', e); }
}

// Statistiques Etendues (Dashboard)
app.get('/api/stats', async (req, res) => {
    try {
        const { data: teachers, error } = await supabase.from('teachers').select('grade, date_retraite, sexe, discipline, matricule, date_naissance');
        if (error) throw error;

        const stats = {
            total: teachers.length,
            categories: { A: 0, B: 0, C: 0, D: 0 },
            upcomingRetirements: 0,
            gender: { M: 0, F: 0 },
            disciplines: {},
            alerts: []
        };

        const currentYear = new Date().getFullYear();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() + 6);

        teachers.forEach(t => {
            // Catégories
            const cat = (t.grade || 'C').charAt(0).toUpperCase();
            if (stats.categories[cat] !== undefined) stats.categories[cat]++;

            // Genre
            const sexe = (t.sexe || 'M').toUpperCase();
            if (stats.gender[sexe] !== undefined) stats.gender[sexe]++;

            // Disciplines
            const disc = t.discipline || 'Non définie';
            stats.disciplines[disc] = (stats.disciplines[disc] || 0) + 1;

            // Retraites & Alertes
            if (t.date_retraite) {
                const retDate = new Date(t.date_retraite);
                if (retDate.getFullYear() === currentYear) stats.upcomingRetirements++;

                // Alerte < 6 mois
                if (retDate <= sixMonthsAgo && retDate >= new Date()) {
                    stats.alerts.push({
                        type: 'retraite_imminente',
                        message: `${t.nom} ${t.prenoms} part en retraite le ${t.date_retraite}`,
                        targetId: t.matricule
                    });
                }
            }

            // Dossiers incomplets
            if (!t.matricule || !t.date_naissance) {
                stats.alerts.push({
                    type: 'dossier_incomplet',
                    message: `Dossier incomplet pour ${t.nom} ${t.prenoms} (Matricule ou Date de naissance manquant)`,
                    targetId: t.matricule || 'Sans Matricule'
                });
            }
        });

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Liste des enseignants
app.get('/api/teachers', async (req, res) => {
    const { search, category } = req.query;
    console.log(`Recherche demandée - Search: "${search || ''}", Catégorie: "${category || 'All'}"`);
    try {
        let query = supabase.from('teachers').select('*');

        if (search) {
            query = query.or(`nom.ilike.%${search}%,prenoms.ilike.%${search}%,matricule.ilike.%${search}%`);
        }

        if (category && category !== 'All') {
            console.log(`Application du filtre catégorie: ${category}`);
            query = query.ilike('grade', `${category}%`);
        }

        const { data, error } = await query.order('nom', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ajout d'un enseignant
app.post('/api/teachers', async (req, res) => {
    const { calculateRetirementDate } = require('./utils/retirement');
    try {
        console.log('--- POST /api/teachers [PATCHED VERSION v2] ---');
        const teacher = req.body;
        console.log('POST /api/teachers - Données reçues:', JSON.stringify(teacher, null, 2));

        // Calcul de la date de retraite
        const retirementDate = calculateRetirementDate(teacher.date_naissance, teacher.grade, teacher.etablissement);
        console.log('Date de retraite calculée:', retirementDate);

        // CORRECTION: Vérifier que retirementDate n'est pas null AVANT d'appeler toISOString()
        let retirementDateStr = null;
        if (retirementDate && retirementDate instanceof Date && !isNaN(retirementDate.getTime())) {
            retirementDateStr = retirementDate.toISOString().split('T')[0];
        }

        const isCollege = teacher.etablissement && teacher.etablissement.toUpperCase().startsWith('CEG');

        const { data, error } = await supabase
            .from('teachers')
            .insert([{
                ...teacher,
                date_retraite: retirementDateStr,
                is_college: isCollege ? true : false
            }])
            .select();

        if (error) throw error;
        console.log('Enseignant créé avec succès:', data[0].id);
        res.json(data[0]);
    } catch (err) {
        console.error('ERREUR POST /api/teachers:', err.message);
        console.error('Stack trace:', err.stack);
        res.status(500).json({ error: err.message });
    }
});

// PDF - Fiche Pédagogique (Existant)
app.get('/api/teachers/:id/pdf', async (req, res) => {
    try {
        const { data: teacher, error } = await supabase.from('teachers').select('*').eq('id', req.params.id).single();
        if (error || !teacher) return res.status(404).json({ error: 'Enseignant non trouvé' });

        const doc = new PDFDocument();
        res.setHeader('Content-disposition', `attachment; filename=fiche_${teacher.matricule}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);
        doc.fontSize(20).text('FICHE PÉDAGOGIQUE INDIVIDUELLE', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Nom : ${teacher.nom}`);
        doc.text(`Prénom(s) : ${teacher.prenoms}`);
        doc.text(`Matricule : ${teacher.matricule}`);
        doc.moveDown();
        doc.fillColor('red').text(`Date de retraite : ${teacher.date_retraite || 'N/A'}`);
        doc.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const LOGO_PATH = 'C:/Users/ADN/.gemini/antigravity/brain/01c3da9c-430b-4f03-aae4-3ea331828176/uploaded_media_1770132419677.png';

function drawDocumentHeader(doc) {
    // Reset fill color
    doc.fillColor('black');

    // 1. Logo du Ministère (Nouvelle image haute qualité)
    try {
        // Hauteur de ~45 pour s'aligner sur les 3 lignes du bloc Ministère
        doc.image(LOGO_PATH, 45, 30, { height: 45 });
    } catch (e) {
        doc.rect(45, 30, 70, 45).stroke();
    }

    // 2. Bloc Ministère (Rapproché du logo : x=95 au lieu de 125)
    doc.font('Helvetica-Bold').fontSize(8.5);
    doc.text('MINISTÈRE DES ENSEIGNEMENTS', 95, 35);
    doc.text('SECONDAIRE, TECHNIQUE ET DE LA', 95, 46);
    doc.text('FORMATION PROFESSIONNELLE', 95, 57);

    // 3. Barre Tricolore Horizontale (Sous le texte du ministère)
    const barY = 70;
    const barHeight = 2.5;
    const barWidth = 160;
    doc.rect(95, barY, barWidth / 3, barHeight).fill('#008751');
    doc.rect(95 + barWidth / 3, barY, barWidth / 3, barHeight).fill('#FCD116');
    doc.rect(95 + (barWidth / 3) * 2, barY, barWidth / 3, barHeight).fill('#E8112D');

    doc.fillColor('black');

    // 4. RÉPUBLIQUE DU BÉNIN
    doc.font('Helvetica-Bold').fontSize(9).text('RÉPUBLIQUE DU BÉNIN', 95, 80);

    // 5. Bloc Contact 1 (En haut à droite)
    doc.font('Helvetica').fontSize(7.5);
    doc.text("Route de l'aéroport", 350, 35, { align: 'right', width: 210 });
    doc.text('✉ : 10 BP 250 Cotonou', 350, 45, { align: 'right', width: 210 });
    doc.text('☎ : (229) 21 32 38 43 ; Fax : 21 32 41 88', 350, 55, { align: 'right', width: 210 });
    doc.text('Web : www.enseignementsecondaire.gouv.bj', 350, 65, { align: 'right', width: 210 });

    // 6. Bloc Contact 2 (En milieu à droite)
    doc.font('Helvetica-Bold').fontSize(7.5);
    doc.text('Immeuble Aliou SALAMI, DASSA-ZOUME,', 350, 85, { align: 'right', width: 210 });
    doc.text('Quartier BAKEMA', 350, 94, { align: 'right', width: 210 });
    doc.text('A côté de la préfecture.', 350, 103, { align: 'right', width: 210 });

    doc.font('Helvetica').fontSize(7.5);
    doc.text('✉ : BP              Dassa-Zoumè', 350, 112, { align: 'right', width: 210 });
    doc.text('☎ : (229)                      ; Fax :', 350, 121, { align: 'right', width: 210 });
    doc.text('Mail : mestfp.ddcollines@gouv.bj', 350, 130, { align: 'right', width: 210 });

    // 7. DIRECTION DEPARTEMENTALE (Positionné sous le logo et la République)
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('DIRECTION DEPARTEMENTALE DES', 50, 115, { align: 'center', width: 500 });
    doc.text('ENSEIGNEMENTS SECONDAIRE, TECHNIQUE ET DE', 50, 129, { align: 'center', width: 500 });
    doc.text('LA FORMATION PROFESSIONNELLE DES COLLINES', 50, 143, { align: 'center', width: 500 });
}

function drawFooterBar(doc) {
    const barWidth = 70;
    const totalWidth = barWidth * 3;
    const startX = (doc.page.width - totalWidth) / 2;
    const barY = 785;
    const barHeight = 5;

    doc.rect(startX, barY, barWidth, barHeight).fill('#008751'); // Vert
    doc.rect(startX + barWidth, barY, barWidth, barHeight).fill('#FCD116'); // Jaune
    doc.rect(startX + barWidth * 2, barY, barWidth, barHeight).fill('#E8112D'); // Rouge
}

const getFormattedDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const month = months[today.getMonth()];
    const year = today.getFullYear();
    return `${day} ${month} ${year}`;
};

// PDF - Certificat de Validité de Service (Format Officiel)
app.get('/api/teachers/:id/certificate-validity', async (req, res) => {
    try {
        const { data: teacher, error } = await supabase.from('teachers').select('*').eq('id', req.params.id).single();
        if (error || !teacher) return res.status(404).json({ error: 'Non trouvé' });

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-disposition', `attachment; filename=certificat_validite_${teacher.matricule}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        drawDocumentHeader(doc);

        const dateLineY = 195;
        doc.fillColor('black').font('Helvetica').fontSize(11.5);
        doc.text(`Dassa-Zoumè, le ${getFormattedDate()}`, 230, dateLineY);

        doc.text(`N°_______ / DDESTFP-COL /MESTFP/SPAF/DAA`, 50, 222);

        doc.moveDown(2.5);
        doc.fontSize(16).font('Helvetica-Bold').text('CERTIFICAT DE VALIDITE DE SERVICE', { align: 'center' });
        doc.fontSize(14).text('-*-*-*-*-*-*-*-', { align: 'center' });

        // Interligne 1.5 avant le corps du document
        doc.moveDown(1.5);

        const teacherCivilite = teacher.sexe === 'F' ? 'Madame' : 'Monsieur';
        const ne = teacher.sexe === 'F' ? 'née' : 'né';
        const la = teacher.sexe === 'F' ? 'elle' : 'il';
        const nom = teacher.nom || '';
        const prenoms = teacher.prenoms || '';
        const nameFormatted = nom && prenoms
            ? `${nom.toUpperCase()} ${prenoms.charAt(0).toUpperCase()}${prenoms.slice(1).toLowerCase()}`
            : '...';

        // Calcul dynamique de l'âge de retraite pour le texte
        const category = (teacher.grade || 'C').charAt(0).toUpperCase();
        let retirementAge = 55;
        if (category === 'A') retirementAge = 60;
        else if (category === 'B') retirementAge = 58;

        const ageText = retirementAge === 60 ? 'soixante (60) ans' :
            retirementAge === 58 ? 'cinquante-huit (58) ans' :
                'cinquante-cinq (55) ans';

        const bodyContent = `Je soussignée, Directrice Départementale des Enseignements Secondaire, Technique et de la Formation Professionnelle des Collines, certifie que ${teacherCivilite} ${nameFormatted}, ${ne} le ${teacher.date_naissance || '...'} à ${teacher.lieu_naissance || '...'} ; Agent Contractuel de Droit Public de l’Etat (ACDPE) ; Corps : ${teacher.corps || '...'} ; Grade : ${teacher.grade || '...'} ; Numéro Matricule : ${teacher.matricule || '...'} ; actuellement en service au ${teacher.etablissement || '...'} en qualité de ${teacher.fonction || '...'} ; est employé dans la Fonction Publique depuis le ${teacher.date_prise_service || '...'} par référence premier contrat et sera probablement ${teacher.sexe === 'F' ? 'admise' : 'admis'} à faire valoir ses droits à une pension de retraite le ${teacher.date_retraite || '...'}, date à laquelle ${la} aura atteint la limite d’âge de ${ageText} ; conformément aux textes en vigueur.`;

        doc.font('Helvetica').fontSize(12).lineGap(5).text(bodyContent, 50, 310, { align: 'justify', width: 495 });

        doc.moveDown(2.5);
        doc.text(`En foi de quoi, le présent Certificat lui est délivré pour servir et valoir ce que de droit.`);

        // Bloc Signature
        doc.moveDown(4);
        const signatureX = 300;
        doc.font('Helvetica-Bold').fontSize(12).text('Clotilde NOUDEVIWA épouse DEDJI', signatureX, doc.y, { align: 'center', width: 250 });
        doc.font('Helvetica').fontSize(10);
        doc.text('Direction Départementale des Enseignements Secondaire, Technique et de la Formation Professionnelle des Collines.', signatureX, doc.y, { align: 'center', width: 250 });

        drawFooterBar(doc);
        doc.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PDF - Présence au Poste (Format Officiel)
app.get('/api/teachers/:id/presence-post', async (req, res) => {
    try {
        const { data: teacher, error } = await supabase.from('teachers').select('*').eq('id', req.params.id).single();
        if (error || !teacher) return res.status(404).json({ error: 'Non trouvé' });

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        res.setHeader('Content-disposition', `attachment; filename=presence_poste_${teacher.matricule}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        drawDocumentHeader(doc);

        const dateLineY = 195;
        doc.fillColor('black').font('Helvetica').fontSize(11.5);
        doc.text(`Dassa-Zoumè, le ${getFormattedDate()}`, 230, dateLineY);

        doc.text(`N°_______ / DDESTFP-COL /MESTFP/SPAF/DAA`, 50, 222);

        doc.moveDown(2.5);
        doc.fontSize(16).font('Helvetica-Bold').text('CERTIFICAT DE PRESENCE AU POSTE', { align: 'center' });
        doc.fontSize(14).text('-*-*-*-*-*-*-*-', { align: 'center' });

        // Interligne 1.5 avant le corps du document
        doc.moveDown(1.5);

        const teacherCivilite = teacher.sexe === 'F' ? 'Madame' : 'Monsieur';
        const nom = teacher.nom || '';
        const prenoms = teacher.prenoms || '';
        const nameFormatted = nom && prenoms
            ? `${nom.toUpperCase()} ${prenoms.charAt(0).toUpperCase()}${prenoms.slice(1).toLowerCase()}`
            : '...';
        const category = (teacher.grade || 'C').charAt(0).toUpperCase();
        const gradeParts = (teacher.grade || '').split('-');
        const echelle = gradeParts[0] || '...';
        const echelon = gradeParts[1] || '...';

        const bodyContent = `Je soussignée, Directrice Départementale des Enseignements Secondaire, Technique et de la Formation Professionnelle des Collines, Certifie que ${teacherCivilite} ${nameFormatted} ; numéro matricule ${teacher.matricule || '...'} ; Agent Contractuel de Droit Public de l’Etat (ACDPE) ; ${teacher.corps || 'PA'} de Discipline ${teacher.discipline || '...'} ; de la Catégorie ${category}, échelle ${echelle} échelon ${echelon} ; muté par Note de Service n°.................... du ..../..../.... à ${teacher.etablissement || '...'}.`;

        doc.font('Helvetica').fontSize(12).lineGap(5).text(bodyContent, 50, 310, { align: 'justify', width: 495 });

        doc.moveDown(1.5);
        doc.text(`Est présent à son poste depuis le ${teacher.date_prise_service || '...'} jusqu’à ce jour, en qualité de ${teacher.fonction || '...'}.`);

        doc.moveDown(2);
        doc.text(`En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.`);

        // Bloc Signature
        doc.moveDown(4);
        const signatureX = 300;
        doc.font('Helvetica-Bold').fontSize(12).text('Clotilde NOUDEVIWA épouse DEDJI', signatureX, doc.y, { align: 'center', width: 250 });
        doc.font('Helvetica').fontSize(10);
        doc.text('Direction Départementale des Enseignements Secondaire, Technique et de la Formation Professionnelle des Collines.', signatureX, doc.y, { align: 'center', width: 250 });

        drawFooterBar(doc);
        doc.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Création d'un nouvel administrateur
app.post('/api/admin/create-user', async (req, res) => {
    const { email, password } = req.body;
    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        const adminClient = require('@supabase/supabase-js').createClient(
            process.env.SUPABASE_URL,
            serviceRoleKey
        );

        const { data, error } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (error) {
            console.log('Admin creation failed, trying public signUp...');
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password
            });
            if (signUpError) throw signUpError;
            return res.json({ message: 'Utilisateur créé (via Sign-up)', user: signUpData.user });
        }
        res.json({ message: 'Administrateur créé avec succès', user: data.user });
    } catch (err) {
        console.error('Erreur Création Admin:', err);
        res.status(500).json({ error: err.message });
    }
});

// Script d'importation (Via Fichier local - existant)
app.get('/api/admin/import-local', async (req, res) => {
    try {
        const excelPath = path.join(__dirname, '..', 'Fichier Personnel_1.xlsx');
        await importExcel(excelPath);
        res.json({ message: 'Importation réussie' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Importation Excel via Upload (Nouveau)
app.post('/api/admin/import-massive', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

        await importExcel(req.file.path);

        // Log Audit
        await createAuditLog(req.headers['x-admin-email'] || 'admin@collines.bj', 'IMPORT', 'Massive', `Importation réussie via fichier: ${req.file.originalname}`);

        // Supprimer le fichier temporaire
        const fs = require('fs');
        fs.unlinkSync(req.file.path);

        res.json({ message: 'Importation massive réussie' });
    } catch (err) {
        console.error('Erreur Import Massive:', err);
        res.status(500).json({ error: err.message });
    }
});

// Mise à jour d'un enseignant
app.put('/api/teachers/:id', async (req, res) => {
    const { calculateRetirementDate } = require('./utils/retirement');
    try {
        const teacher = req.body;
        console.log('PUT /api/teachers/:id - Données reçues:', JSON.stringify(teacher, null, 2));

        const retirementDate = calculateRetirementDate(teacher.date_naissance, teacher.grade, teacher.etablissement);
        console.log('Date de retraite calculée:', retirementDate);

        // CORRECTION: Vérifier que retirementDate n'est pas null AVANT d'appeler toISOString()
        let retirementDateStr = null;
        if (retirementDate && retirementDate instanceof Date && !isNaN(retirementDate.getTime())) {
            retirementDateStr = retirementDate.toISOString().split('T')[0];
        }

        const isCollege = teacher.etablissement && teacher.etablissement.toUpperCase().startsWith('CEG');

        const { data, error } = await supabase
            .from('teachers')
            .update({
                ...teacher,
                date_retraite: retirementDateStr,
                is_college: isCollege ? true : false
            })
            .eq('id', req.params.id)
            .select();

        if (error) throw error;

        // Log Audit
        await createAuditLog(req.headers['x-admin-email'] || 'admin@collines.bj', 'UPDATE', teacher.matricule, `Mise à jour du profil de ${teacher.nom}`);

        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Archivage d'un enseignant
app.patch('/api/teachers/:id/archive', async (req, res) => {
    try {
        const { is_archived, matricule } = req.body;
        const { data, error } = await supabase
            .from('teachers')
            .update({ is_archived })
            .eq('id', req.params.id)
            .select();

        if (error) throw error;

        // Log Audit
        await createAuditLog(req.headers['x-admin-email'] || 'admin@collines.bj', 'ARCHIVE', matricule, `Archivage: ${is_archived}`);

        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Journal d'audit
app.get('/api/admin/audit-logs', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Modification pour Vercel (Export de l'app)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Serveur Supabase prêt sur http://localhost:${port}`);
    });
}

module.exports = app;
