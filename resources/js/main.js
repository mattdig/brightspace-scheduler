const bs = new Brightspace(ORG_UNIT_ID);

async function whoAmI(){
    let user = await bs.get('/d2l/api/lp/(version)/users/whoami');
    user.Identifier = parseInt(user.Identifier);
    return user;
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

function getGroup(groupId){
    let group = bs.get('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + groupId);
    return group;
}

async function getClassList(product = 'le'){
    let classList = [];
    let url = (product == 'le') ? '/d2l/api/le/(version)/(orgUnitId)/classlist/' : '/d2l/api/bas/(version)/orgunits/(orgUnitId)/classlist/';
    let response = await bs.get(url);
    if(response.Objects !== undefined){
        response = response.Objects;
    }

    for(student of response){
        if(student.Identifier !== undefined)
            classList[student.Identifier] = student;
        else
            classList[student.UserId] = student;
    }
    return classList;
}

async function sendEmail(address, subject, body){

    let url = '/d2l/le/email/' + ORG_UNIT_ID + '/SendEmail';

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

function selectAll(obj){
    let checked = $(obj).prop('checked');
    $(obj).closest('table').find('.select_row').prop('checked', checked);
}

function modalInit(){
    let newModal = '<div class="modal modal-dialog-scrollable fade" id="messageModal" tabindex="-1" role="dialog" aria-labelledby="messageModalCenterTitle" aria-hidden="true"><div class="modal-dialog modal-dialog-centered" role="document"><div class="modal-content"><div class="modal-header"><button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button></div><div class="modal-body"></div><div class="modal-footer"><button id="modalCancel" type="button" class="btn btn-close" data-dismiss="modal">Cancel</button><button type="button" id="modalOk" class="btn btn-primary" data-dismiss="modal">Okay</button></div></div></div></div>';
    $('body').append(newModal);
    $(document).ready(function(){
        var myModal = document.getElementById('messageModal');
        var myInput = document.getElementById('modalOk');
        myModal.addEventListener('shown.bs.modal', function () {
            console.log('modal shown');
            myInput.focus();
        });
        myModal.addEventListener('hide.bs.modal', function () {
            console.log('modal hide');
            $('#modalOk').off('click');
            $('#modalCancel').hide();
        });
    }, 20);
}

function modalMessage(message, id = null, callback = null, title = null, okText = 'Okay', cancelText = null){
    if(typeof(message) == 'object'){
        id = message.id;
        callback = message.callback;
        title = message.title;
        if(typeof(message.okText) == 'string'){
            okText = message.okText;
        }
        if(typeof(message.cancelText) == 'string'){
            cancelText = message.cancelText;
        }
        message = message.message;
    }
    if($('#messageModal').length == 0){
        modalInit();
    }
    if(cancelText !== null){
        $('#modalCancel').html(cancelText).show();
    }
    if(id !== null){
        if(typeof(id) == 'string')
            $('#' + id).addClass('error');
        else
            $(id).addClass('error');
    }
    $('#messageModal').find('.modal-body').html('<p>' + message + '</p>');
    let primary = $('#modalOk');
    if(callback !== null){
        primary.on('click', callback);
    }
    $('#messageModal').modal('show');
}

function modalConfirm(message, callback = null, title = null, okText = 'Okay', cancelText = 'Cancel'){
    modalMessage(message, null, callback, title, okText, cancelText);
}