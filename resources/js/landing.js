let bs = new Brightspace(ORG_UNIT_ID);
async function redirect(){
    let myEnrollment = await bs.get('/d2l/api/lp/(version)/enrollments/myenrollments/(orgUnitId)/access');
    let isInstructor = myEnrollment.Access.LISRoles.every(element => {
        return !(element.indexOf('Learner') > -1 || element.indexOf('Student') > -1);
    });

    let redirect = PLUGIN_PATH + '/' + (isInstructor ? 'setup' : 'signup') + '.html?ou=' + ORG_UNIT_ID + '&gc=' + GROUP_CATEGORY_ID;
    
    window.location.replace(redirect);
}
redirect();