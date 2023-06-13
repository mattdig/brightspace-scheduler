const params = new Proxy(new URLSearchParams(window.top.location.search), {get: (searchParams, prop) => searchParams.get(prop)});
let CFG = params.cfg;
let MODE = 'create';
if(CFG !== null){
    CFG = JSON.parse(atob(CFG));
    MODE = 'edit';
}
let GROUP_CATEGORY_ID = (MODE == 'edit' ? CFG.gc : null);
let TOPIC_ID = 0;
let SUBMITTING = false;
let TIMEZONE;
let CLASSLIST;
let TITLE;
let ORG_INFO = bs.get('/d2l/api/lp/(version)/organization/info');
let COURSE = bs.get('/d2l/api/lp/(version)/courses/' + ORG_UNIT_ID);
let GROUPS = (MODE == 'edit' ? getGroupsInCategory() : null);

let timeBlocks = [];
let newGroups = [];

$(function(){init();});

async function init(){

    let associatedGroups = false;
    if(MODE == 'edit' && 'agc' in CFG){
        associatedGroups = getGroupsInCategory(CFG.agc);
    }

    const promises = await Promise.all([
        ORG_INFO,
        COURSE,
        GROUPS, 
        bs.get('/d2l/api/lp/(version)/' + ORG_UNIT_ID + '/groupcategories/'), 
        associatedGroups,
        bs.get('/d2l/api/lp/(version)/enrollments/myenrollments/(orgUnitId)/access')
    ]);

    ORG_INFO = promises[0];
    COURSE = promises[1];
    GROUPS = promises[2];
    let otherGroupCategories = promises[3];
    associatedGroups = promises[4];
    let access = promises[5];

    let isTA = false;

    // define roles in config file
    for(role of TEACHING_ASSISTANT_ROLES){
        if(access.Access.ClasslistRoleName.indexOf(role) > -1){
            isTA = true;
            break;
        }
    }
    
    TIMEZONE = ORG_INFO.TimeZone;

    moment.tz.setDefault(TIMEZONE);

    for(const og of otherGroupCategories){
        $('#associated_group_category').append($('<option>', {value: og.GroupCategoryId, text: og.Name}));
    }

    if(MODE == 'edit'){

        CLASSLIST = getClassList();

        TOPIC_ID = CFG.t;

        $('#form_title').html('Edit Signup Schedule');

        let groupCategory = await getGroupCategory();
        TITLE = groupCategory.Name;
        $('#title').val(TITLE);
        $('#schedule_title').html(groupCategory.Name);

        if(groupCategory.SelfEnrollmentExpiryDate != null){
            $('#expiry_date').html("Last day to sign up: " + moment.utc(groupCategory.SelfEnrollmentExpiryDate, 'YYYY-MM-DDTHH:mm:ss.fffZ').subtract(1, 'days').tz(TIMEZONE).format('MMM Do, YYYY'));
            $('#expiry_date').show();
        }

        $('#max_users__row').remove();
        $('#enddate__row').remove();

        // tas can't delete the schedule, this can be removed if you want
        if(isTA){
            $('#delete_schedule').remove();
        }

        if(groupCategory.Description.Text != ''){
            $('#schedule_description').html(groupCategory.Description.Text.replace('\n','<br />'));
            $('#description').val(groupCategory.Description.Text);
            $('#schedule_description').show();
        }

        if(groupCategory.MaxUsersPerGroup > 1){
            $('#associated_group_category__label').show();
        }

        if('agc' in CFG){
            let associatedGroupCategory = false;
            for(const og of otherGroupCategories){
                if(og.GroupCategoryId == CFG.agc){
                    associatedGroupCategory = og;
                    break;
                }
            }

            $('#associated_group_category').val(CFG.agc);
            $('#associated_group_category_name').html(associatedGroupCategory.Name);
            $('#autofill_group_registration__buton').click(function(){
                autofillGroupRegistration(associatedGroups);
            });
            $('#autofill_group_registration').show();
        }

        await getExistingTimeSlots();
        let calendarEvent = await bs.get('/d2l/api/le/(version)/(orgUnitId)/calendar/event/' + existingTimeSlots[0].eventId);
        $('#event_title').val(calendarEvent.Title);
        
        await displayExistingTimeSlots(groupCategory);

        $('#add_new_timeblocks').show();

        $('#edit_schedule').show();

    } else {
        $('#form_title').html('Create New Signup Schedule');
        await getModules();
        $('#module_selection').show();
        $('#edit_timeblocks').show();
        
        $('#schedule_enddate').val('').datetimepicker({
            format: 'YYYY-MM-DD',
            minDate: moment().subtract(1, 'days'),
            maxDate: moment().add(1, 'years')
        });
    
        $('#signup_schedule__form').show();
    }

    let firstDateTime = $('.datetime__div').first();
    initializeDatetime(firstDateTime);
    firstDateTime.find('.btn-remove').on('click', removeDatetime);

    $('#timeslot_duration').on('change', function(){
        updateTotalTimeSlots();
    });

    $('#max_users').on('change', function(){
        if($('#max_users').val() > 1){
            $('#associated_group_category__label').show();
        } else {
            $('#associated_group_category__label').hide();
        }
    });

}

async function getModules(){
    let modules = await bs.get("/d2l/api/le/(version)/(orgUnitId)/content/root/");
    $('#module__select').empty();
    for(const module of modules){
        $('#module__select').append($('<option>', {value: module.Id, text: module.Title}));
    }
}

async function updateEventTitle(element){
    if($('#event_title').val() == ''){
        $('#event_title').val(element.value);
    }
}

async function getExistingTimeSlots(){
        
    for(group of GROUPS){
        
        let data = group.Code.split('_');

        let startTime = moment.utc(data[0], 'YYYYMMDDHHmm').tz(TIMEZONE);
        let endTime = moment.utc(data[1], 'YYYYMMDDHHmm').tz(TIMEZONE);

        //let localDateTimeFormat = startTime.format('MMM[&nbsp;]Do[&nbsp;]YYYY, h:mm[&nbsp;]A') + '&nbsp;-&nbsp;' + endTime.format('h:mm[&nbsp;]A');
        
        group.Start = startTime;
        group.End = endTime;
        //group.Name = localDateTimeFormat;
        group.EventId = data[2];
    };

    existingTimeSlots.sort(compareStarttime);
}

async function displayExistingTimeSlots(groupCategory){

    if(existingTimeSlots.length == 0){
        return false;
    }

    let duration = 0;

    let html = '<tr><th>Registration</th><th>Date & Time</th><th>Actions</th></tr>';

    $('#existing_timeslots__table').html(html);

    CLASSLIST = await CLASSLIST;

    for(group of GROUPS){
        
        let students = '';

        if(groupCategory.MaxUsersPerGroup > 0){
            students = '<span class="timeslot-student-count">' + group.Enrollments.length + '</span>/' + groupCategory.MaxUsersPerGroup + '<br />';
        }
            
        if(group.Enrollments.length > 0){
            for(let studentId of group.Enrollments){
                students += '<span id="student_' + studentId + '">' + CLASSLIST[studentId].DisplayName + ' (' + CLASSLIST[studentId].OrgDefinedId + ')<br /></span>';
            }

        } else if(groupCategory.MaxUsersPerGroup == 1) {
            students = '&nbsp;-&nbsp;';
        }

        if(duration == 0){
            duration = group.End.diff(group.Start, 'minutes');
        }

        html = '<tr class="timeslot" id="timeslot_' + group.GroupId + '">';
        html += '<td class="timeslot-registration">' + students + '</td>';
        html += '<td class="timeslot_datetime">' + group.Name + '</td>';
        html += '<td class="timeslot_actions">';

        html += '<button class="btn btn-secondary btn-sm enrollStudents" data-id="' + group.GroupId + '">Add Registrations</button>';
        
        if(group.Enrollments.length > 0){
            if(groupCategory.MaxUsersPerGroup > 1)
                html += '<button class="btn btn-secondary btn-sm unenrollStudents" data-id="' + group.GroupId + '">Cancel Registrations</button>';
            else
                html += '<button class="btn btn-secondary btn-sm unenrollStudents" data-id="' + group.GroupId + '">Cancel Registration</button>';
        }
        html += '<button class="btn btn-red btn-sm delete-timeslot" data-id="' + group.GroupId + '">Delete Time Slot</button></td>';
        html += '</td>';
        html += '</tr>';

        $('#existing_timeslots__table').append(html);
        
        if(groupCategory.MaxUsersPerGroup > 1)
            $('#existing_timeslots__table #timeslot_' + group.GroupId).find('.enrollStudents').on('click', function(){manageEnrollment('add', group.GroupId)});

        if(groupCategory.MaxUsersPerGroup > 1)
            $('#existing_timeslots__table #timeslot_' + group.GroupId).find('.unenrollStudents').on('click', function(){manageEnrollment('remove', group.GroupId)});
        else
            $('#existing_timeslots__table #timeslot_' + group.GroupId).find('.unenrollStudents').on('click', function(){
                modalConfirm(
                    'Are you sure you cancel this registration?<br />The student will be removed and they will be able to select a different time.',
                    function(){cancelSingleEnrollment(group);}
                );
            });
        
        
        $('#existing_timeslots__table #timeslot_' + group.GroupId).find('.delete-timeslot').on('click', function(){
            modalConfirm(
                'Are you sure you want to delete this time slot?<br />It will remove all registrations and associated events for this time.',
                function(){deleteTimeSlot(group)}
            );
        });
    }
    
    $('#existing_timeslots').show();
    $('#timeslot_duration').val(duration);

    return true;

}

function addDatetime(){
    if($('#edit_timeblocks').is(':visible')){
        let lastDatetime = $('.datetime__div').last();
        let newDateTime = orderDatetimeElems(lastDatetime.clone(), $('.datetime__div').length + 1);
        
        // set select values from last datetime (clone doesn't work?)
        newDateTime.find('.starttime_input').val(lastDatetime.find('.starttime_input').val());
        newDateTime.find('.endtime_input').val(lastDatetime.find('.endtime_input').val());
        
        newDateTime.find('.btn-remove').on('click', removeDatetime);
        newDateTime.insertAfter(lastDatetime);
        initializeDatetime($('.datetime__div').last());   // initialize the new datetime
    } else {
        $('#edit_timeblocks').show();
        validateTimeFields();
    }
}

function removeDatetime(element){
    if($('.datetime__div').length > 1){
        let target = $(element.target);
        $('#datetime_' + target.data('counter')).remove();
        orderDatetimeElems();
        validateTimeFields();
    } else if($('.datetime__div').length == 1 && MODE == 'edit'){
        $('#edit_timeblocks').hide();
        $('#add_new_timeblocks').show();
    }
}

function orderDatetimeElems(element = null, counter = null){

    if(element == null){
        element = $('.datetime__div');
    }

    element.each(function(index, elem){

        if(counter != null){
            index = counter;
        } else {
            index = index + 1;
        }

        elem = $(elem);

        elem.attr('id', 'datetime_' + index);
        elem.find('h3').find('span').text('Date & Time ' + index);
        elem.find('h3').find('button').data('counter', index);
        elem.find('label.date_label').attr('for', 'date_' + index);
        elem.find('label.starttime_label').attr('for', 'starttime_' + index);
        elem.find('label.endtime_label').attr('for', 'endtime_' + index);
        
        elem.find('input.date_input').attr('id', 'date_' + index).attr('name', 'date_' + index);
        elem.find('select.starttime_input').attr('id', 'starttime_' + index).attr('name', 'starttime_' + index);
        elem.find('select.endtime_input').attr('id', 'endtime_' + index).attr('name', 'endtime_' + index);
    });

    return element;
}

function initializeDatetime(datetimeElem){

    //let latestTime = globalLatestTime.clone();

    let latestTime = moment();
    let initializeTimes = true;

    if($('.datetime__div').length > 1){
        initializeTimes = false;
        let lastDatetime = $('.datetime__div').last().prev();
        latestTime = moment(lastDatetime.find('.date_input').val() + ' ' + lastDatetime.find('.starttime_input').val(), 'YYYY-MM-DD HH:mm').add(1, 'days');
    }

    let interval = 30;

    let remainder = latestTime.minutes() % interval;
    
    if(remainder < interval / 2){
        latestTime.subtract(remainder, 'minutes');
    } else {latestTime.add(interval - remainder, 'minutes');}
    
    $(datetimeElem).find('.date_input').val('').datetimepicker({
        format: 'YYYY-MM-DD',
        defaultDate: moment(latestTime),
        minDate: moment().subtract(1, 'days'),
        maxDate: moment().add(1, 'years')
    }).on('dp.hide', function(e){
        validateTimeFields(false);
    });

    
    

    if(initializeTimes){
        latestTime = momentFromTime(latestTime.format('HH:mm'));
    
        let minTime = momentFromTime('00:00');
        let maxTime = latestTime.clone().add(1, 'hours');

        generateTimeOptions($(datetimeElem).find('.starttime_input'), latestTime, minTime, maxTime, interval);

        minTime = latestTime.clone().add(30, 'minutes');
        maxTime = momentFromTime('23:59');

        generateTimeOptions($(datetimeElem).find('.endtime_input'), latestTime.clone().add(1, 'hours'), minTime, maxTime, interval);
    }

    $(datetimeElem).find('.starttime_input').on('change', function(){
        let object = $(datetimeElem).find('.endtime_input')
        let time = momentFromTime(object.val());
        let startTime = momentFromTime($(this).val()).add(interval, 'minutes');
        let endTime = momentFromTime('23:59');
        generateTimeOptions(object, time, startTime, endTime, interval);
        validateTimeFields(false);
    });

    $(datetimeElem).find('.endtime_input').on('change', function(){
        let object = $(datetimeElem).find('.starttime_input')
        let time = momentFromTime(object.val());
        let startTime = momentFromTime('00:00');
        let endTime = momentFromTime($(this).val());
        generateTimeOptions(object, time, startTime, endTime, interval);
        validateTimeFields(false);
    });

    // minTime = latestTime.clone().add(30, 'minutes');
    // maxTime = moment([0, 0, 0, 23, 30, 0, 0]);

    
    validateTimeFields(false);

}

function generateTimeOptions(object, defaultTime = false, startTime = 0, endTime = 0, interval = 60){

    let options = [];

    if(!defaultTime){
        defaultTime = momentFromTime('12:00');
    }

    if(startTime === 0){
        startTime = momentFromTime('00:00');
    }

    if(endTime === 0){
        endTime = momentFromTime('23:59');
    }

    if(defaultTime.isBefore(startTime) || defaultTime.isBefore(startTime)){
        defaultTime = startTime.clone();
    }

    for(let i = 0; i < (24 * (60 / interval)); i++){
        let time = startTime.clone().add(i * interval, 'minutes');

        if(time.isBefore(endTime)){
            let selected = time.isSame(defaultTime) ? 'selected="selected"' : '';
            
            options.push('<option value="' + time.format('HH:mm') + '" ' + selected + '>' + time.format('h:mm A') + '</option>');
        }
    }

    $(object).empty().append(options.join(''));
    
}

function updateTotalTimeSlots(){
    
    newGroups = [];
    let totalTimeSlots = 0;
    let timeSlotDuration = 0;
    let totalTime = 0;

    timeSlotDuration = parseInt($('#timeslot_duration').val());

    if(timeSlotDuration < 5){
        $('#total_timeslots').text('Please enter a time slot duration of at least 5 minutes.');
        return false;
    }

    timeBlocks.forEach(block => {
        totalTime += block.end.diff(block.start, 'minutes');

        let timeSlotsInBlock = parseInt(Math.floor(block.end.diff(block.start, 'minutes') / timeSlotDuration));

        for(let i = 0; i < timeSlotsInBlock; i++){
            let newGroup = {
                GroupId: null,
                EventId: null,
                Start: block.start.clone().add(i * timeSlotDuration, 'minutes'),
                End: block.start.clone().add((i + 1) * timeSlotDuration, 'minutes'),
            };
            newGroups.push(newGroup);
        }

        totalTimeSlots += timeSlotsInBlock;
        
    });

    if(totalTime > 90){
        //convert to hours with 2 decimal places
        totalTime = parseFloat((totalTime / 60).toFixed(2));
        units = 'hours';
    } else {
        units = 'minutes';
    }

    $('#total_time').text('Total time: ' + totalTime + ' ' + units);

    if(totalTimeSlots > 0){
        $('#total_timeslots').text('This will create ' + totalTimeSlots + ' time slots of ' + timeSlotDuration + ' minutes each.');
        return true;
    } else {
        $('#total_timeslots').text('No new timeslots will be created.');
        return false;
    }

}



function updateGlobalLatestTime(newTime){
    
    let now = moment();

    if(globalLatestTime == null || newTime.isAfter(globalLatestTime)){
        globalLatestTime = newTime.clone();
    }

    if(globalLatestTime.hours() > 22){
        globalLatestTime.add(1, 'days').hours(8).minutes(0);
    }

    if(globalLatestTime.isBefore(now)){
        globalLatestTime = now.clone();
    }
    
}


function validateTimeFields(withErrors){

    globalLatestTime = null;

    let valid = true;
    newGroups = [];
    timeBlocks = [];

    let datetimes = [];
    
    let latestTime = moment();

    //let selectedTab = $('.tab-pane.active').find('label').attr('for');
    //let blockValue = parseInt($('#' + selectedTab).val());

    if($('#edit_timeblocks').is(':visible')){
        $('.datetime__div').each(function(){
            let datetime = {};
            let format = "YYYY-MM-DD HH:mm";
            let date = $(this).find('.date_input').val() + " ";
            datetime.id = $(this).attr('id');
            datetime.start = moment(date + $(this).find('.starttime_input').val(), format);
            datetime.end = moment(date + $(this).find('.endtime_input').val(), format);
            datetimes.push(datetime);
        });
    } else {
        return true;
    }

    datetimes.sort(compareStarttime);
    
    for(const [i, datetime1] of datetimes.entries()){
        if(datetime1.start.isAfter(datetime1.end) || datetime1.start.isSame(datetime1.end)){

            if(withErrors){
                modalMessage('Start time must be before end time.', $('#' + datetime1.id).find('select'));
            }
            return false;
        
        } else {

            let spliceIndexes = [];

            for(const [j, datetime2] of datetimes.slice(i + 1).entries()){
                if(datetime1.id != datetime2.id && (
                    datetime1.start.isAfter(datetime2.start) && datetime1.start.isBefore(datetime2.end) || 
                    datetime1.end.isAfter(datetime2.start) && datetime1.end.isBefore(datetime2.end) ||
                    datetime2.start.isAfter(datetime1.start) && datetime2.start.isBefore(datetime1.end) || 
                    datetime2.end.isAfter(datetime1.start) && datetime2.end.isBefore(datetime1.end) ||
                    datetime1.start.isSame(datetime2.start) || datetime1.end.isSame(datetime2.end))){
                    
                    if(withErrors){
                        modalMessage('Time ranges must not overlap.', $('#' + datetime2.id).find('.timeblock_datetime_input'));
                        return false;
                    }
                    valid = false;
                } else {
                    if(datetime1.end.isSame(datetime2.start)){
                        datetime1.end = datetime2.end.clone();
                        spliceIndexes.push(i + j + 1);
                    }
                }
            }

            for(const [j, datetime2] of existingTimeSlots.entries()){
                
                if( datetime1.start.isAfter(datetime2.start) && datetime1.start.isBefore(datetime2.end) || 
                    datetime1.end.isAfter(datetime2.start) && datetime1.end.isBefore(datetime2.end) ||
                    datetime2.start.isAfter(datetime1.start) && datetime2.start.isBefore(datetime1.end) || 
                    datetime2.end.isAfter(datetime1.start) && datetime2.end.isBefore(datetime1.end) ||
                    datetime1.start.isSame(datetime2.start) || datetime1.end.isSame(datetime2.end)){
                    
                    if(withErrors){
                        modalMessage('New time ranges must not overlap with existing time slots.', $('#' + datetime1.id).find('.timeblock_datetime_input'));
                        return false;
                    }
                    valid = false;
                }
            }

            timeBlocks.push(datetime1);

            spliceIndexes.forEach(function(index){
                datetimes.splice(index, 1);
            });
            
            if(datetime1.end.isAfter(latestTime)){
                latestTime = datetime1.end.clone();
            }
        }
    }

    if(!updateTotalTimeSlots() && $('#edit_timeblocks').is(':visible') && withErrors){
        modalMessage('No new time slots will be created. Please adjust your time ranges or duration.');
        valid = false;
    }
    
    //updateGlobalLatestTime(latestTime);

    return valid;

}

function compareStarttime(a, b){
    if(a.start.isBefore(b.start)){
        return -1;
    } else if(a.start.isAfter(b.start)){
        return 1;
    } else {
        return 0;
    }
}


function validateAllFields(){

    $(':input').removeClass('error');

    let title = $('#title').val();
    
    if(title == ''){
        $('#title').addClass('error');
        return false;
    }

    let event_title = $('#event_title').val();
    
    if(event_title == ''){
        $('#event_title').addClass('error');
        return false;
    }
    
    // not supported by api
    // let deadlineDate = moment($('#deadline_date').val() + ' ' + $('#deadline_time').val(), 'YYYY-MM-DD HH:mm');
    // if(deadlineDate.isBefore(moment())){
    //     modalMessage('Deadline must be after today.', [$('#deadline_date') , $('#deadline_time')]);
    //     return false;
    // }

    let valid = validateTimeFields(true);

    if(valid && MODE == 'create'){
        valid = parseInt($('#max_users').val()) > 0 && parseInt($('#max_users').val()) <= 1000;
        if(!valid){
            modalMessage('Max users per timeslot must be between 1 and 1000.', $('#max_users'));
        }
    }

    return(valid);

}

async function submitForm(){

    if(!SUBMITTING){

        let promiseArray = [];

        SUBMITTING = true;
        $('#save').val('Saving...');
        $('#signup_schedule__form').find(':input').prop('disabled', true);

        if(!validateAllFields(true)){
            return cancelSubmit();
        }

        if(ORG_UNIT_ID == null){
            modalMessage('All fields are valid, but Org Unit Id is not defined');
            return cancelSubmit();
        }

        let groupCategory;
        let newTopic;

        if(MODE == 'create'){
            groupCategory = await createGroupCategory();

            GROUP_CATEGORY_ID = groupCategory.CategoryId;
            newTopic = await createTopic();
            TOPIC_ID = newTopic.Id;
        } else {
            const result = await Promise.all([
                updateGroupCategory(),
                updateTopic()
            ]);
        }


        if(GROUP_CATEGORY_ID != null){

            let groupsInCategory = null;

            if(MODE == 'create'){
                groupsInCategory = await getGroupsInCategory();
            } else {

                promiseArray = [];

                for (group of GROUPS){
                    promiseArray.push(updateCalendarEvent(group));
                }

                await Promise.all(promiseArray);
            }

            promiseArray = [];

            for(const [index,newGroup] of newGroups.entries()){

                let group = (MODE == 'create' ? groupsInCategory[index] : false);
                
                promiseArray.push(createGroupAndEvent(newGroup, group));

            };

            await Promise.all(promiseArray);
        }

        reloadAfterSave();

    }

}

function cancelSubmit(){
    SUBMITTING = false;
    $('#save').val('Save');
    $('#signup_schedule__form').find(':input').prop('disabled', false);
    return false;
}

async function createGroupAndEvent(newGroup, targetGroup){
    
    if(!targetGroup){
        targetGroup = await createGroup(newGroup);
    }
    
    let newEvent = await createCalendarEvent(targetGroup);
    
    targetGroup.EventId = newEvent.CalendarEventId;
    
    return await updateGroup(targetGroup);
    
}

function reloadAfterSave(){
    if(MODE == 'create'){
        window.top.location.href = '/d2l/le/content/' + ORG_UNIT_ID + '/viewContent/' + TOPIC_ID + '/View'; 
    } else {
        window.top.location.reload();
    }
}

function createGroupCategory(){
    
    let title = $('#title').val().trim();
    let description = $('#description').val().trim();
    let maxUsers = parseInt($('#max_users').val().trim());
    
    let endDateString = $('#schedule_enddate').val().trim();
    let endDateUTC = null;
    // if string matches date format
    if(endDateString.match(/^\d{4}-\d{2}-\d{2}$/)){
        let endDateMoment = moment(endDateString + ' 00:00', 'YYYY-MM-DD HH:mm').add(1, 'days');

        if(endDateMoment.isAfter(moment())){
            endDateUTC = convertToUTCDateTimeString(endDateMoment);
        }
    }

    let category = {
        "Name": title,
        "Description": {"Content": description, "Type":"Text"},
        "EnrollmentStyle": "PeoplePerNumberOfGroupsSelfEnrollment",
        "EnrollmentQuantity": null,
        "AutoEnroll": false,
        "RandomizeEnrollments": false,
        "NumberOfGroups": newGroups.length,
        "MaxUsersPerGroup": maxUsers,
        "AllocateAfterExpiry": false,
        "SelfEnrollmentExpiryDate": endDateUTC, // || null
        "GroupPrefix": null,
        "RestrictedByOrgUnitId": null,
        "DescriptionsVisibleToEnrolees": true
    };
    
    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/', category);
    
}

async function updateGroupCategory(){

    let title = $('#title').val().trim();
    let description = $('#description').val().trim();
    //let maxUsers = parseInt($('#max_users').val());

    // DEADLINE NOT SUPPORTED BY API
    // MaxUsersPerGroup not supported by API
    // TODO: SWITCH TO SUBMITTING FORM DATA
    // let format = "YYYY-MM-DD HH:mm";
    // let deadlineDate = $('#deadline_date').val();
    // let deadlineTime = $('#deadline_time').val();
    
    // let deadlineUTCDateTime = convertToUTCDateTimeString(moment(deadlineDate + " " + deadlineTime, format));

    let category = {
        "Name": title,
        "Description": {"Content": description, "Type":"Text"},
        "AutoEnroll": false,
        "RandomizeEnrollments": false,
        // "MaxUsersPerGroup": maxUsers,
        // "SelfEnrollmentExpiryDate": null, //deadlineUTCDateTime, //<string:UTCDateTime>( yyyy-MM-ddTHH:mm:ss.fffZ )|null,
        // "RestrictedByOrgUnitId": null,
        "DescriptionsVisibleToEnrolees": true
    };
    
    return bs.put('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID, category);

}

function createGroup(group){
    
    let newGroup = {
        "Name": group.Start.format('MMM Do YYYY, h:mm A') + '-' + group.End.format('h:mm A'),
        "Code": "",
        "Description": { "Content": "", "Type": "Text" },
    }

    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/', newGroup);
    
}

async function updateGroup(group){
    
    let updateGroup = {
        "Name": group.Start.format('MMM Do YYYY, h:mm A') + '-' + group.End.format('h:mm A'),
        "Code": convertToUTCDateTimeString(group.Start, true) + '_' + convertToUTCDateTimeString(group.End, true) + '_' + group.EventId,
        "Description": { "Content": "", "Type": "Text" }
    };

    return bs.put('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + group.GroupId, updateGroup);
    
}

function createCalendarEvent(group){

    let event_title = $('#event_title').val().trim();
    if(event_title == ''){
        event_title = $('#title').val().trim();
    }

    let event = {
        "Title": event_title,
        "Description": "",
        "StartDateTime": convertToUTCDateTimeString(group.Start),
        "EndDateTime": convertToUTCDateTimeString(group.End),
        "StartDay": null,
        "EndDay": null,
        "GroupId": group.GroupId,
        "RecurrenceInfo": null,
        "LocationId": null,
        "LocationName": "",
        "AssociatedEntity": null,
        "VisibilityRestrictions": {
            "Type": 1,
            "Range": null,
            "HiddenRangeUnitType": null,
            "StartDate": null,
            "EndDate": null
        }
    };

    return bs.post('/d2l/api/le/(version)/(orgUnitId)/calendar/event/', event);
   
}

async function updateCalendarEvent(group){
    let event_title = $('#event_title').val().trim();
    if(event_title == ''){
        event_title = $('#title').val().trim();
    }

    let event = {
        "Title": event_title,
        "Description": "",
        "StartDateTime": convertToUTCDateTimeString(group.Start),
        "EndDateTime": convertToUTCDateTimeString(group.End),
        "StartDay": null,
        "EndDay": null,
        "GroupId": group.GroupId,
        "RecurrenceInfo": null,
        "LocationId": null,
        "LocationName": "",
        "AssociatedEntity": null,
        "VisibilityRestrictions": {
            "Type": 1,
            "Range": null,
            "HiddenRangeUnitType": null,
            "StartDate": null,
            "EndDate": null
        }
    };

    return bs.put('/d2l/api/le/(version)/(orgUnitId)/calendar/event/' + group.EventId, event);
}


async function createTopic(){

    let title = $('#title').val().trim();

    let pluginPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));

    let orgUnitInfo = await bs.get('/d2l/api/lp/(version)/courses/(orgUnitId)');
    let targetModuleId = $('#module__select').val();
    let response = await fetch(pluginPath + '/resources/html/landing.tpl');
    let content = await response.text();
    content = content.replace(/\(pluginPath\)/g, pluginPath);
    
    configOptionsJSON = {};
    configOptionsJSON.gc = GROUP_CATEGORY_ID;

    if($('#max_users').val() > 1 && $('#associated_group_category').val() != ''){
        configOptionsJSON.agc = parseInt($('#associated_group_category').val());
        configOptionsJSON.rt = 1;
    }

    content = content.replace(/\(configOptionsJSON\)/g, JSON.stringify(configOptionsJSON));
    
    let topic = [
        {
            "IsHidden": false,
            "IsLocked": false,
            "ShortTitle": null,
            "Type": 1,
            "DueDate": null,
            "Url": orgUnitInfo.Path + "Scheduler.html",
            "StartDate": null,
            "TopicType": 1,
            "EndDate": null,
            "Title": title
        },
        content
    ];

    return bs.post('/d2l/api/le/(version)/(orgUnitId)/content/modules/' + targetModuleId + '/structure/?renameFileIfExists=true', topic);

}

async function updateTopic(){

    let title = $('#title').val().trim();

    let topic = await bs.get('/d2l/api/le/(version)/(orgUnitId)/content/topics/' + TOPIC_ID);

    topic = {
        "Title": title,
        "ShortTitle": "",
        "Type": 1,
        "TopicType": 1,
        "Url": topic.Url,
        "IsHidden": false,
        "IsLocked": false,
        "MajorUpdateText": ""        
    }

    return bs.put('/d2l/api/le/(version)/(orgUnitId)/content/topics/' + TOPIC_ID, topic);

}

async function deleteTimeSlot(group, sendNotifications = true){
    $('#timeslot_' + group.GroupId).remove();
    let promises = [];
    promises.push(deleteCalendarEvent(group.EventId));
    for(student of group.Enrollments){
        promises.push(unenrollFromGroup(group, student, sendNotifications));
    }
    await Promise.all(promises);
    await deleteGroup(group.GroupId);

    // remove group from GROUPS
    GROUPS = GROUPS.filter(function(g) {
        return g.GroupId !== group.GroupId;
    });
}

async function manageEnrollment(action, groupId){
    
    let message = '<h3>' + (action == 'add' ? 'Add' : 'Remove') + ' Registrations</h3>';

    let studentTable = '<div><table class="d2l-table" id="student_table"><thead><tr>';
    
    let studentList = [];

    if(action == 'add'){
        studentList = CLASSLIST.filter(function(student) {

            let isStudent = false;

            let inGroup = false;

            // define roles in config file
            for(role of STUDENT_ROLES){

                if(student.ClasslistRoleDisplayName.indexOf(role) > -1){
                    isStudent = true;

                    for(g of GROUPS){
                        if(g.Enrollments.includes(student.Identifier)){
                            inGroup = true;
                            break;
                        }
                    }

                    break;
                }
            }

            return isStudent && !inGroup;
        });

        studentTable += '<th>&nbsp;</th>';
    } else {
        let group = await getGroup(groupId);

        for(student of group.Enrollments){
            studentList.push(CLASSLIST[student]);
        }

        studentTable += '<th onclick="clickSubInput(event)"><input type="checkbox" class="select_all" onclick="selectAll(this)"></th>';
    };
    
    studentTable += '<th>Student</th></tr></thead><tbody>';

    studentList.sort(dynamicSort("DisplayName"));

    for(student of studentList){
        studentTable += '<tr><td onclick="clickSubInput(event)"><input type="checkbox" class="select_row" id="select_student_'+student.Identifier+'" value="' + student.Identifier + '"></td><td><label for="select_student_'+student.Identifier+'">' + student.DisplayName + '</label></td></tr>';
    }
    studentTable += '</tbody></table></div>';

    message += studentTable;

    message += '<p style="margin-top:20px;">';
    
    if(action == 'add'){
        message += '<input type="button" class="btn btn-primary" value="Add Selected" onclick="let checked = $(\'#student_table\').find(\'.select_row:checked\').clone(); addStudentsToGroup(' + groupId + ',checked);">';
    } else {
        message += '<input type="button" class="btn btn-red" value="Remove Selected" onclick="let checked = $(\'#student_table\').find(\'.select_row:checked\').clone(); confirmRemoveStudentsFromGroup(' + groupId + ',checked);">';
    }
    
    message += '</p>';

    modalMessage(message);
}

function clickSubInput(e){
    if($(e.target).not('input')){
        $(e.target).find('input').click();
    }
}

function confirmRemoveStudentsFromGroup(groupId, checkedStudents){
    if(checkedStudents.length == 0){
        return false;
    }
    modalConfirm(
        'Are you sure you want to cancel these registrations?<br />The selected students will be removed and they will be able to select a different time:<br />' + selectedStudentNames(checkedStudents),
        function(){removeStudentsFromGroup(groupId, checkedStudents);}
    );
}

function selectedStudentNames(checkedStudents){
    let names = '';
    checkedStudents.each(function(){
        names += CLASSLIST[this.value].DisplayName + '<br>';
    });
    return names;
}

async function removeStudentsFromGroup(groupId, checkedStudents){

    //find the group
    let group = GROUPS.find(function(g) {
        return g.groupId == groupId;
    });

    let promises = [];

    //remove the students from the group
    checkedStudents.each(function(){
        let studentId = this.value;
        promises.push(unenrollFromGroup(group, studentId));
        $('#student_' + studentId).remove();
        group.Enrollments = group.Enrollments.filter(function(id) {
            return id != parseInt(studentId);
        });
    });

    if(group.Enrollments.length == 0){
        $('#timeslot_' + groupId).find('.manage-timeslot').hide();
    }

    $('#timeslot_' + groupId).find('.timeslot-student-count').html(group.Enrollments.length);

    await Promise.all(promises);

}

async function addStudentsToGroup(groupId, checkedStudents){

    promises = [];

    for(student of checkedStudents){
        promises.push(enrollStudentInGroup(groupId, student.value));
    }

    await Promise.all(promises);

    reloadAfterSave();

}

async function autofillGroupRegistration(associatedGroups){
    let promises = [];
    let groupEnrolledStudents = [];
    
    for(group of GROUPS){
        for(student of group.Enrollments){
            groupEnrolledStudents[student] = group.GroupId;
        }
    };

    for(group of associatedGroups){

        studentsToEnroll = [];
        studentsAlreadyEnrolled = [];
        for(student of group.Enrollments){
            if(groupEnrolledStudents[student]){
                studentsAlreadyEnrolled.push(student);
            } else {
                studentsToEnroll.push(student);
            }
        }

        if(studentsToEnroll.length > 0 && studentsAlreadyEnrolled.length > 0){
            for(student of studentsToEnroll){
                promises.push(enrollStudentInGroup(groupEnrolledStudents[studentsAlreadyEnrolled[0]], student));
            }
        }
    }
    
    await Promise.all(promises);
    
    reloadAfterSave();
}

async function enrollStudentInGroup(groupId, userId){

    //find group with groupId
    let group = GROUPS.find(function(g) {
        return g.GroupId == groupId;
    });

    group.Enrollments.push(userId);

    let user = {"UserId": userId};
    let enroll = bs.post('/d2l/api/lp/(version)/' + ORG_UNIT_ID + '/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + groupId + '/enrollments/', user);

    let host = window.top.location.host;
    
    let calendarUrl = 'https://' + host + '/d2l/le/calendar/' + ORG_UNIT_ID;
    let topicUrl = 'https://' + host + '/d2l/le/content/' + ORG_UNIT_ID + '/viewContent/' + TOPIC_ID + '/View';

    let pluginPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));

    let subject = 'Brightspace Scheduling: Your time slot is confirmed';

    result = await fetch(pluginPath + '/resources/html/emailstudentenrolled.tpl');
    body = await result.text();

    body = body.replace(/\(courseName\)/g, COURSE.Name);
    body = body.replace(/\(scheduleTitle\)/g, TITLE);
    body = body.replace(/\(timeSlot\)/g, group.Name);
    
    body = body.replace(/\(feedUrl\)/g, '');
    
    body = body.replace(/\(topicUrl\)/g, topicUrl);
    body = body.replace(/\(calendarUrl\)/g, calendarUrl);

    let studentEmail = CLASSLIST[userId].Email;
    let email = sendEmail(studentEmail, subject, body);
    await Promise.all([enroll, email]);
}

async function cancelSingleEnrollment(group){
    $('#timeslot_' + group.GroupId + ' .timeslot-registration').html('&nbsp;-&nbsp;');
    $('#timeslot_' + group.GroupId).find('.manage-timeslot').remove();
    
    let result = await unenrollFromGroup(group, group.Enrollments[0]);

    return result;
}

async function notifyOfCancellation(userId){

    let pluginPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));
    let result = await fetch(pluginPath + '/resources/html/emailstudentcancelled.tpl');
    let body = await result.text();
    
    let studentEmail = CLASSLIST[userId].Email;
    let subject = 'Brightspace Scheduling: Your time slot was cancelled';
    let topicUrl = 'https://' + window.top.location.host + '/d2l/le/content/' + ORG_UNIT_ID + '/viewContent/' + TOPIC_ID + '/View';
    
    body = body.replace(/\(courseName\)/g, COURSE.Name);
    body = body.replace(/\(scheduleTitle\)/g, TITLE);
    body = body.replace(/\(topicUrl\)/g, topicUrl);
    
    let email = sendEmail(studentEmail, subject, body);
}

async function unenrollFromGroup(group, userId, sendNotifications = true){
    let url = '/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + group.GroupId + '/enrollments/' + userId;
    if(sendNotifications){
        notifyOfCancellation(userId);
    }

    group.Enrollments = group.Enrollments.filter(function(id) {
        return id != userId;
    });

    return bs.delete(url);
}

function deleteCalendarEvent(eventId){    
    return bs.delete('/d2l/api/le/(version)/(orgUnitId)/calendar/event/' + eventId);
}

function deleteGroup(groupId){
    return bs.delete('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + groupId);
}

function deleteGroupCategory(){
    return bs.delete('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID);
}

function deleteTopic(){
    return bs.delete('/d2l/api/le/(version)/(orgUnitId)/content/topics/' + TOPIC_ID);
}

function confirmDeleteSchedule(){
    modalConfirm('Are you sure you want to delete this schedule?<br />This will remove all time slots and registrations.',
        function(){
            function doubleConfirmDeleteSchedule(){
                $('#messageModal').off('hidden.bs.modal', doubleConfirmDeleteSchedule);
                modalConfirm(
                    'Are you really sure?<br />This will remove all time slots and registrations.',
                    deleteSchedule
                );
            }
            $('#messageModal').on('hidden.bs.modal', doubleConfirmDeleteSchedule);
        }
    );
}

async function deleteSchedule(){
    let deleteArray = [];

    for(let i = 0; i < existingTimeSlots.length; i++){
        deleteArray.push(deleteTimeSlot(existingTimeSlots[i], false));
    }

    await Promise.all(deleteArray);
    await deleteTopic();
    await deleteGroupCategory();

    window.top.location.href = '/d2l/le/content/' + ORG_UNIT_ID + '/Home';
}

function momentFromTime(time){

    let defaultDate = '2020-01-01 ';
    let defaultDateTimeFormat = 'YYYY-MM-DD HH:mm';

    return moment(defaultDate + time, defaultDateTimeFormat);

}

function convertToUTCDateTimeString(date, safe = false){

    let utcDate = date.clone().utc();

    let format;

    if(safe){
        format = 'YYYYMMDDHHmm';
    } else {
        format = 'YYYY-MM-DDTHH:mm:00.000';
    }

    return utcDate.format(format) + (safe ? '' : 'Z');

}