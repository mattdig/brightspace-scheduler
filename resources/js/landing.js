let url = window.top.location.href;
let match = url.match(/\/content\/(\d+)\/viewContent\/(\d+)\//);
let ORG_UNIT_ID = match[1];
let TOPIC_ID = match[2];

const bs = new Brightspace(ORG_UNIT_ID);

async function isStudent(){
    let myEnrollment = await bs.get('/d2l/api/lp/(version)/enrollments/myenrollments/(orgUnitId)/access');
    for(LISRole of myEnrollment.Access.LISRoles){
        for(role of IMS_STUDENT_ROLES){
            if(LISRole.indexOf(role) > -1){
                return true;
            }
        }
    }
    return false;
}

async function redirect(){
    let student = isStudent();
    let config = {};
    if(typeof(CONFIG) !== 'undefined'){
        config = JSON.parse(CONFIG);
    } else {
        config.gc = GROUP_CATEGORY_ID;
    }
    
    config.t = TOPIC_ID;
    config = btoa(JSON.stringify(config));

    student = await student;

    let redirect = '/d2l/lp/navbars/' + ORG_UNIT_ID + '/customlinks/external/' + ((student) ? signupLinkId : adminLinkId) + '?cfg=' + config;
    
    if(student){
        window.location.replace(redirect);
    } else {
        window.top.location.replace(redirect);
    }
}

window.onload = function(event) {
    redirect();
};