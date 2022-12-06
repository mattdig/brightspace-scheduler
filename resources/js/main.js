const bs = new Brightspace(ORG_UNIT_ID); 

function whoAmI(){
    return bs.get('/d2l/api/lp/(version)/users/whoami');
}

async function isInstructor(){
    let myEnrollment = await bs.get('/d2l/api/lp/(version)/enrollments/myenrollments/(orgUnitId)/access');
    let isInstructor = myEnrollment.Access.LISRoles.some(element => {
        let isLeanrer = (element.indexOf('Learner') > -1 || element.indexOf('Student') > -1);
        return !isLeanrer;
    });
    return isInstructor;
}

function getGroupCategory(categoryId){
    let groupCategory = bs.get('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID);
    return groupCategory;
}

function getGroupsInCategory(){
    let groups = bs.get('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/');
    return groups;
}

async function getClassList(product = 'le'){
    let classList = [];
    let url = (product == 'le') ? '/d2l/api/le/(version)/(orgUnitId)/classlist/' : '/d2l/api/bas/(version)/orgunits/(orgUnitId)/classlist/';
    let response = await bs.get(url);
    if(response.Objects !== undefined){
        response = response.Objects;
    }

    for(student of response){
        classList[student.Identifier] = student;
    }
    return classList;
}

async function sendEmail(address, subject, body){

    let url = 'https://brightspacedev.carleton.ca/d2l/le/email/' + ORG_UNIT_ID + '/SendEmail';

    // encode text for json
    body = body.replace(/"/g, '\\"');

    let formData = {
        "ToAddresses$items$Value":address,
        "ToAddresses$items$Key": "",
        "ToAddresses$items$ActionType": "Add",
        "ToAddresses$items`1$Value": "",
        "ToAddresses$items`1$Key": "",
        "ToAddresses$items`1$ActionType": "",
        "AutoCompleteTo$SelectionInfo$value": address,
        "AutoCompleteTo$SelectionInfo$key": "",
        "CcAddresses$items$Value": "",
        "CcAddresses$items$Key": "",
        "CcAddresses$items$ActionType": "None",
        "AutoCompleteCc$SelectionInfo$value": "",
        "AutoCompleteCc$SelectionInfo$key": -1,
        "BccAddresses$items$Value": "",
        "BccAddresses$items$Key": "",
        "BccAddresses$items$ActionType": "None",
        "AutoCompleteBcc$SelectionInfo$value": "",
        "AutoCompleteBcc$SelectionInfo$key": -1,
        "AddedToAddresses": "",
        "AddedCcAddresses": "",
        "AddedBccAddresses": "",
        "DraftMessageId": 0,
        "ParentMessageId": 0,
        "ParentMessageStatus": 0,
        "Subject": subject,
        "BodyHtml$id": "BodyHtml",
        "BodyHtml$htmlOrgUnitId": ORG_UNIT_ID,
        "BodyHtml$html":body,
        "Priority": 3,
        "Attachments$files$ActionType": "None",
        "Attachments$files$PluginKey": "",
        "Attachments$files$Id": "",
        "Attachments$files$FileSize": "",
        "isXhr": true,
        "requestId": 18
    };

    return bs.submit(url, formData);
}

function modalMessage(message, id = null, callback = null){
    
    if(id !== null){
        if(typeof(id) == 'string')
            $('#' + id).addClass('error');
        else
            $(id).addClass('error');
    }
    
    $('#messageModel').find('.modal-title').html('Error');
    $('#messageModal').find('.modal-body').html('<p>' + message + '</p>');

    if(callback !== null){
        $('#messageModal').find('.modal-footer').find('.btn-primary').on('click', callback);
    }

    // is it in an iframe?
    let theWindow = window.self === window.top ? window : window.parent;

    $('#messageModal').css('top', $(theWindow).scrollTop() + 'px');

    $('#messageModal').modal('show');

}