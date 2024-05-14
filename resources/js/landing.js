let url = window.top.location.href;
let match_instructor = url.match(/\/lessons\/(\d+)\/topics\/(\d+)/);
let match_student = url.match(/\/enhancedSequenceViewer\/(\d+)\?url=(\S+)activity%2F(\d+)/)

let ORG_UNIT_ID = 0;
let TOPIC_ID = 0;

if (match_instructor != null) {
    ORG_UNIT_ID = match_instructor[1];
    TOPIC_ID = match_instructor[2];
} else if (match_student != null) {
    ORG_UNIT_ID = match_student[1];
    TOPIC_ID = match_student[3];
}

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

    let redirect = '/d2l/lp/navbars/' + ORG_UNIT_ID + '/customlinks/external/' + ((await student) ? signupLinkId : adminLinkId) + '?cfg=' + config;
    window.top.location.replace(redirect);
}

window.onload = function(event) {
    redirect();
};