const fs = require('fs');
let content = fs.readFileSync('c:/Users/ADN/Desktop/projet oncle/server/index.js', 'utf8');

const newHeader = `function drawDocumentHeader(doc) {
    // Reset fill color
    doc.fillColor('black');

    // 1. Logo du Ministère (Nouvelle image haute qualité)
    try {
        // Hauteur de ~45 pour s'aligner sur les 3 lignes du bloc Ministère
        doc.image(LOGO_PATH, 45, 30, { height: 45 });
    } catch (e) {
        doc.rect(45, 30, 70, 45).stroke();
    }

    // 2. Bloc Ministère (Décalé pour laisser place au logo)
    doc.font('Helvetica-Bold').fontSize(8.5);
    doc.text('MINISTÈRE DES ENSEIGNEMENTS', 125, 35);
    doc.text('SECONDAIRE, TECHNIQUE ET DE LA', 125, 46);
    doc.text('FORMATION PROFESSIONNELLE', 125, 57);

    // 3. Barre Tricolore Horizontale (Sous le texte du ministère)
    const barY = 70;
    const barHeight = 2.5;
    const barWidth = 160;
    doc.rect(125, barY, barWidth / 3, barHeight).fill('#008751'); // Vert
    doc.rect(125 + barWidth / 3, barY, barWidth / 3, barHeight).fill('#FCD116'); // Jaune
    doc.rect(125 + (barWidth / 3) * 2, barY, barWidth / 3, barHeight).fill('#E8112D'); // Rouge

    doc.fillColor('black');

    // 4. RÉPUBLIQUE DU BÉNIN
    doc.font('Helvetica-Bold').fontSize(9).text('RÉPUBLIQUE DU BÉNIN', 125, 80);

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

    // 7. DIRECTION DEPARTEMENTALE (Centré sous l'en-tête global)
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('DIRECTION DEPARTEMENTALE DES', 50, 145, { align: 'center', width: 500 });
    doc.text('ENSEIGNEMENTS SECONDAIRE, TECHNIQUE ET DE', 50, 159, { align: 'center', width: 500 });
    doc.text('LA FORMATION PROFESSIONNELLE DES COLLINES', 50, 173, { align: 'center', width: 500 });
}`;

// Replacement regex for the whole function
content = content.replace(/function drawDocumentHeader\(doc\) \{[\s\S]*?\n\}/, newHeader);

// Fix signature blocks (using regex to match the mangled patterns)
const cleanSignature = `        // Bloc Signature
        doc.moveDown(4);
        const signatureX = 300;
        doc.font('Helvetica-Bold').fontSize(12).text('Clotilde NOUDEVIWA épouse DEDJI', signatureX, doc.y, { align: 'center', width: 250 });
        doc.font('Helvetica').fontSize(10);
        doc.text('Direction Départementale des Enseignements Secondaire, Technique et de la Formation Professionnelle des Collines.', signatureX, doc.y, { align: 'center', width: 250 });`;

// Replace all signature blocks (finding them by Clotilde's name which might be slightly mangled)
content = content.replace(/\/\/ Bloc Signature[\s\S]*?width: 250 \}\);/g, cleanSignature);

// Final cleanup of the whole file for any other mangles
content = content.replace(/pouse/g, 'épouse');
content = content.replace(/Ministre/g, 'Ministère');
content = content.replace(/Rpublique/g, 'République');
content = content.replace(/Bnin/g, 'Bénin');
content = content.replace(/Dpartementale/g, 'Départementale');
content = content.replace(/aroport/g, 'aéroport');
content = content.replace(/prfecture/g, 'préfecture');
content = content.replace(/Dassa-Zoum/g, 'Dassa-Zoumè');

fs.writeFileSync('c:/Users/ADN/Desktop/projet oncle/server/index.js', content, 'utf8');
console.log('Revert and fix completed.');
