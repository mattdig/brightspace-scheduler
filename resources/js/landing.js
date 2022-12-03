const bs = new Brightspace(ORG_UNIT_ID);

async function isInstructor(){
    let myEnrollment = await bs.get('/d2l/api/lp/(version)/enrollments/myenrollments/(orgUnitId)/access');
    let isInstructor = myEnrollment.Access.LISRoles.some(element => {
        let isLeanrer = (element.indexOf('Learner') > -1 || element.indexOf('Student') > -1);
        return !isLeanrer;
    });
    return isInstructor;
}

async function redirect(){
    let redirect = PLUGIN_PATH + '/' + ((await isInstructor()) ? 'setup' : 'signup') + '.html?ou=' + ORG_UNIT_ID + '&gc=' + GROUP_CATEGORY_ID;
    window.location.replace(redirect);
}

window.onload = function(event) {
    redirect();
};