let bs = new Brightspace(ORG_UNIT_ID);

let myEnrollment = await bs.get('/d2l/api/lp/(version)/enrollments/myenrollments/(orgUnitId)/access');
let isInstructor = myEnrollment.Access.LISRoles.every(element => {
    return (element.indexOf('Learner') > -1 || element.indexOf('Student') > -1);
});

if(isInstructor) {
    window.location.href = PLUGIN_PATH + '/setup.html?ou=' + ORG_UNIT_ID + '&gc=' + GROUP_CATEGORY_ID;
} else {
    window.location.href = PLUGIN_PATH + '/signup.html?ou=' + ORG_UNIT_ID + '&gc=' + GROUP_CATEGORY_ID;
}