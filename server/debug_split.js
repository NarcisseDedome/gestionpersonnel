const { calculateRetirementDate } = require('./utils/retirement');

async function test() {
    console.log('--- TEST START ---');

    const teacher = {
        nom: "TEST",
        prenoms: "Test",
        matricule: "123",
        sexe: "M",
        date_naissance: "1990-08-11", // Valid date
        grade: "A1-1",
        etablissement: "CEG 1 DASSA"
    };

    console.log('Testing normal teacher:', teacher);

    try {
        const retirementDate = calculateRetirementDate(teacher.date_naissance, teacher.grade, teacher.etablissement);
        console.log('Retirement Date:', retirementDate);

        let retirementDateStr = null;
        if (retirementDate && retirementDate instanceof Date && !isNaN(retirementDate.getTime())) {
            retirementDateStr = retirementDate.toISOString().split('T')[0]; // CHECK 1
        }
        console.log('Retirement Date Str:', retirementDateStr);

        const isCollege = teacher.etablissement && teacher.etablissement.toUpperCase().startsWith('CEG');
        console.log('Is College:', isCollege);

    } catch (e) {
        console.error('ERROR in Normal Test:', e);
    }

    console.log('\n--- TEST NULL DATE ---');
    const teacherNull = {
        nom: "TEST",
        prenoms: "Test",
        matricule: "123",
        sexe: "M",
        date_naissance: null, // NULL date
        grade: null,
        etablissement: null
    };

    try {
        const retirementDate = calculateRetirementDate(teacherNull.date_naissance, teacherNull.grade, teacherNull.etablissement);
        console.log('Retirement Date (Null input):', retirementDate);

        let retirementDateStr = null;
        if (retirementDate && retirementDate instanceof Date && !isNaN(retirementDate.getTime())) {
            retirementDateStr = retirementDate.toISOString().split('T')[0]; // CHECK 2
        }
        console.log('Retirement Date Str (Null input):', retirementDateStr);
    } catch (e) {
        console.error('ERROR in Null Test:', e);
    }

    console.log('\n--- TEST UNDEFINED ---');
    try {
        const undef = undefined;
        // undef.split('a'); // This would cause the error

        // Check if anything else called split in retirement.js
        calculateRetirementDate(undefined, undefined, undefined);
    } catch (e) {
        console.error('ERROR in Undefined Test:', e);
    }

    console.log('--- TEST END ---');
}

test();
