/**
 * Calcule la date de retraite d'un enseignant basé sur sa catégorie et son établissement.
 * 
 * @param {string} birthDateStr - Date de naissance au format JJ/MM/AAAA ou nombre (Excel format)
 * @param {string} grade - Grade de l'enseignant (la 1ère lettre détermine la catégorie)
 * @param {string} establishment - Nom de l'établissement (commence par CEG pour les collèges)
 * @returns {Date} Date de départ à la retraite
 */
function calculateRetirementDate(birthDateStr, grade, establishment) {
    // Validation stricte du type et de la valeur
    if (!birthDateStr) {
        console.log('calculateRetirementDate: birthDateStr est vide ou null');
        return null;
    }

    try {
        let birthDate;

        // Gestion du format de date Excel (nombre de jours depuis 1900)
        if (typeof birthDateStr === 'number') {
            birthDate = new Date((birthDateStr - 25569) * 86400 * 1000);
        } else {
            // S'assurer que birthDateStr est bien une chaîne
            const dateString = String(birthDateStr);

            // Détection du format : YYYY-MM-DD (UI) ou DD/MM/YYYY (Excel/Import manuel)
            if (dateString.includes('-')) {
                birthDate = new Date(dateString);
            } else if (dateString.includes('/')) {
                const parts = dateString.split('/');
                if (parts.length === 3) {
                    const [day, month, year] = parts.map(Number);
                    birthDate = new Date(year, month - 1, day);
                } else {
                    console.warn('Format de date invalide:', dateString);
                    return null;
                }
            } else {
                // Tentative de parsing direct si format inconnu
                birthDate = new Date(dateString);
            }
        }

        if (!birthDate || isNaN(birthDate.getTime())) {
            console.warn('Date de naissance invalide après parsing:', birthDateStr);
            return null;
        }

        // Protection contre les années invalides ou extrêmes dans l'Excel
        if (birthDate.getFullYear() > 2100) {
            console.warn(`Date de naissance invalide détectée: ${birthDate.toISOString()}`);
            birthDate.setFullYear(2100);
        }
        if (birthDate.getFullYear() < 1900) {
            birthDate.setFullYear(1900);
        }

        // 1. Déterminer l'âge de la retraite selon la catégorie
        const category = grade ? grade.charAt(0).toUpperCase() : 'C';
        let retirementAge = 55; // Par défaut C, D et autres

        if (category === 'A') {
            retirementAge = 60;
        } else if (category === 'B') {
            retirementAge = 58;
        }

        // 2. Calculer l'anniversaire de retraite
        const retirementAnniversary = new Date(birthDate);
        retirementAnniversary.setFullYear(birthDate.getFullYear() + retirementAge);

        // 3. Appliquer la règle selon l'établissement
        const isCollege = establishment && establishment.toUpperCase().startsWith('CEG');

        if (isCollege) {
            // Règle Collège : 01 Octobre suivant l'anniversaire de retraite
            let retirementDate = new Date(retirementAnniversary.getFullYear(), 9, 1); // 9 = Octobre (0-indexed)

            // Si l'anniversaire est après le 1er Octobre, c'est l'année suivante
            if (retirementAnniversary > retirementDate) {
                retirementDate.setFullYear(retirementDate.getFullYear() + 1);
            }
            return retirementDate;
        } else {
            // Règle Générale : 1er jour du trimestre suivant le trimestre d'anniversaire
            const month = retirementAnniversary.getMonth(); // 0-11
            const quarter = Math.floor(month / 3); // 0, 1, 2, 3

            // Trimestre suivant
            const nextQuarterFirstMonth = (quarter + 1) * 3;

            const retirementDate = new Date(retirementAnniversary.getFullYear(), nextQuarterFirstMonth, 1);
            return retirementDate;
        }
    } catch (error) {
        console.error('Erreur dans calculateRetirementDate:', error.message, 'Input:', birthDateStr);
        return null;
    }
}

module.exports = { calculateRetirementDate };
