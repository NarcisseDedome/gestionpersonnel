const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const FEMININE_NAMES = [
    'MARIE', 'ROSE', 'GRACE', 'IRENE', 'DIANE', 'MONIQUE', 'CLARISSE', 'VANESSA',
    'THERESE', 'YVETTE', 'ELISE', 'COLETTE', 'GEORGETTE', 'BERNADETTE', 'ANTOINETTE',
    'ANGELE', 'ALICE', 'AMINATA', 'FATOUMATA', 'AWA', 'RAMATOU', 'ZAINAB', 'SOLANGE',
    'ESTHER', 'LUCIE', 'FLORENCE', 'ADELAIDE', 'CHARLOTTE', 'MARGUERITE', 'RACHEL',
    'REBECCA', 'SARAH', 'LEA', 'NOELIE', 'JULIE', 'JUSTINE', 'SYLVIE', 'MARTINE',
    'ISABELLE', 'NATHALIE', 'VALERIE', 'PASCALINE', 'CLOTILDE', 'GENEVIEVE', 'HELENE',
    'MADELEINE', 'VICTORINE', 'JEANNE', 'PAULETTE', 'ODETTE', 'FRANCOISE', 'CATHERINE',
    'ANNE', 'SOPHIE', 'CHANTAL', 'BEATRICE', 'VERONIQUE', 'DOMINIQUE', 'MURIEL', 'BRIGITTE'
];

const FEMININE_ENDINGS = [
    'ETTE', 'INE', 'ELLE', 'ENCE', 'ANTE', 'ANNE', 'IE', 'ISE', 'IE', 'A', 'AH'
];

async function fixGenders() {
    console.log('--- Début du nettoyage des genres ---');

    const { data: teachers, error } = await supabase
        .from('teachers')
        .select('id, nom, prenoms, sexe')
        .eq('sexe', 'M');

    if (error) {
        console.error('Erreur lecture:', error);
        return;
    }

    console.log(`${teachers.length} enregistrements "M" trouvés.`);
    let fixCount = 0;

    for (const teacher of teachers) {
        const prenoms = (teacher.prenoms || '').toUpperCase();
        const firstPrenom = prenoms.split(' ')[0].split('-')[0];

        let isFeminine = false;

        // Check if full prenom contains any of the known feminine names
        if (FEMININE_NAMES.some(name => prenoms.includes(name))) {
            isFeminine = true;
        }

        // Check first prenom ending
        if (!isFeminine) {
            if (FEMININE_ENDINGS.some(ending => firstPrenom.endsWith(ending))) {
                // Heuristic: Avoid common male endings like 'E' (unless in FEMININE_NAMES)
                // but 'INE', 'ETTE' are very strong indicators
                if (firstPrenom.endsWith('INE') || firstPrenom.endsWith('ETTE') || firstPrenom.endsWith('ELLE')) {
                    isFeminine = true;
                }
            }
        }

        if (isFeminine) {
            const { error: updateError } = await supabase
                .from('teachers')
                .update({ sexe: 'F' })
                .eq('id', teacher.id);

            if (updateError) {
                console.error(`Erreur update ${teacher.nom} ${teacher.prenoms}:`, updateError);
            } else {
                fixCount++;
                console.log(`[FIX] ${teacher.nom} ${teacher.prenoms} -> F`);
            }
        }
    }

    console.log(`--- Nettoyage terminé. ${fixCount} corrections effectuées. ---`);
}

fixGenders();
