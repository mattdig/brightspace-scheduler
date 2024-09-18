async function whoAmI(){
    let user = await bs.get('/d2l/api/lp/(version)/users/whoami');
    user.Identifier = parseInt(user.Identifier);
    return user;
}

async function isInstructor(){
    let myEnrollment = await bs.get('/d2l/api/lp/(version)/enrollments/myenrollments/(orgUnitId)/access');
    for(LISRole of myEnrollment.Access.LISRoles){
        // uses IMS defined roles, not the role names from the system
        for(role of IMS_INSTRUCTOR_ROLES){
            if(element.indexOf(role) > -1){
                return true;
            }
        }
    }
    return false;
}

function getGroupCategory(categoryId = false){

    if(categoryId === false){
        categoryId = GROUP_CATEGORY_ID;
    }

    let groupCategory = bs.get('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + categoryId);
    return groupCategory;
}

function getGroupsInCategory(categoryId = false){

    if(categoryId === false){
        categoryId = GROUP_CATEGORY_ID;
    }

    let groups = bs.get('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + categoryId + '/groups/');
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
    
    // return empty array if the classlist is empty or user doesn't have permission
    if(response === false || response instanceof Array && response.length == 0 || response.constructor == Object && typeof(response.Error) !== 'undefined'){
        return [];
    }

    for(student of response){
        if(student.Identifier !== undefined){
            student.Identifier = parseInt(student.Identifier);
            classList[student.Identifier] = student;
        }
        else{
            student.UserId = parseInt(student.UserId);
            classList[student.UserId] = student;
        }
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
    let newModal = '<div class="modal modal-dialog-scrollable fade" id="messageModal" tabindex="-1" role="dialog" aria-labelledby="messageModalCenterTitle"><div class="modal-dialog modal-dialog-centered" role="document"><div class="modal-content"><div class="modal-header"><button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button></div><div class="modal-body"></div><div class="modal-footer"><button type="button" id="modalOk" class="btn btn-primary" data-dismiss="modal">OK</button> <button id="modalCancel" type="button" class="btn btn-secondary btn-close" data-dismiss="modal">Cancel</button></div></div></div></div>';
    $('body').append(newModal);
    let myModal = $('#messageModal');
    myModal.on('shown.bs.modal', function () {
        $('#modalOk').focus();
    });
    myModal.on('hide.bs.modal', function () {
        $('#modalOk').off('click');
        $('#modalCancel').hide();
    });    
    return myModal;
}

function modalMessage(message, id = null, callback = null, title = null, okText = 'OK', cancelText = null){
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
    var myModal = $('#messageModal');
    if(myModal.length == 0){
        myModal = modalInit();
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
    myModal.find('.modal-body').html('<p>' + message + '</p>');
    let primary = $('#modalOk');
    if(callback !== null){
        primary.on('click', function(){
            setTimeout(callback,0);
        });
    }
    myModal.modal('show');
    //$('#modalOk').focus();
}

function modalConfirm(message, callback = null, title = null, okText = 'OK', cancelText = 'Cancel'){
    modalMessage(message, null, callback, title, okText, cancelText);
}

function download(filename, mime, text) {
    
    let blob = new Blob([text], { type: mime });
    let a = window.document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
}

function dynamicSortMultiple() {
    var props=[];
    /*Let's separate property name from ascendant or descendant keyword*/
    for(var i=0; i < arguments.length; i++){
        var splittedArg=arguments[i].split(/ +/);
        props[props.length]=[splittedArg[0], (splittedArg[1] ? splittedArg[1].toUpperCase() : "ASC")];
    }
    return function (obj1, obj2) {
        var i = 0, result = 0, numberOfProperties = props.length ;
        /*Cycle on values until find a difference!*/
        while(result === 0 && i < numberOfProperties) {
            result = dynamicSort(props[i][0], props[i][1])(obj1, obj2);
            i++;
        }
        return result;
    }
}

/*Base function returning -1,1,0 for custom sorting*/
function dynamicSort(property, isAscDesc) { 
    return function (obj1,obj2) {
        if(isAscDesc==="DESC"){
            return ((obj1[property] > obj2[property]) ? (-1) : ((obj1[property] < obj2[property]) ? (1) : (0)));
        }
        /*else, if isAscDesc==="ASC"*/
        return ((obj1[property] > obj2[property]) ? (1) : ((obj1[property] < obj2[property]) ? (-1) : (0)));
    }
}