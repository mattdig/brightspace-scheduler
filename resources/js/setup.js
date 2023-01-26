const params = new Proxy(new URLSearchParams(window.top.location.search), {get: (searchParams, prop) => searchParams.get(prop)});
let MODE = (window.top.location.search.indexOf('gc=') != -1 ? 'edit' : 'create');
let GROUP_CATEGORY_ID = (MODE == 'edit' ? params.gc : null);
let TOPIC_ID = 0;
let SUBMITTING = false;
let TIMEZONE;
let CLASSLIST = getClassList();

let timeBlocks = [];
let existingTimeSlots = [];
let newTimeSlots = [];

$(function(){init();});

async function init(){

    console.log(ORG_UNIT_ID, MODE, GROUP_CATEGORY_ID, TOPIC_ID);

    let orgInfo = await bs.get('/d2l/api/lp/(version)/organization/info');
    TIMEZONE = orgInfo.TimeZone;

    moment.tz.setDefault(TIMEZONE);

    // $('#timeslot_number').on('change', function(){
    //     updateTotalTimeSlots();
    // });

    // not supported by api
    //generateTimeOptions($('#deadline_time'));

    if(MODE == 'edit'){

        TOPIC_ID = params.t;

        $('#form_title').html('Edit Signup Schedule');

        // deadline not supported by api
        // TODO: switch to fetching the HTML page for the form and parsing it
        let groupCategory = await getGroupCategory(GROUP_CATEGORY_ID);
        $('#title').val(groupCategory.Name);
        $('#schedule_title').html(groupCategory.Name);
        $('#max_users__row').remove();
        //$('#max_users').val(groupCategory.MaxUsersPerGroup);

        if(groupCategory.Description.Text != ''){
            $('#schedule_description').html(groupCategory.Description.Text.replace('\n','<br />'));
            $('#description').val(groupCategory.Description.Text);
            $('#schedule_description').show();
        }

        // not supported by api
        // $('#deadline_date').val(moment.utc(groupCategory.SelfEnrollmentExpiryDate, 'YYYY-MM-DDTHH:mm:ss.fffZ').tz(TIMEZONE).format('YYYY-MM-DD'));
        // $('#deadline_time').val(moment.utc(groupCategory.SelfEnrollmentExpiryDate, 'YYYY-MM-DDTHH:mm:ss.fffZ').tz(TIMEZONE).format('HH:mm'));
        
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
        $('#signup_schedule__form').show();
    }

    let firstDateTime = $('.datetime__div').first();
    initializeDatetime(firstDateTime);
    firstDateTime.find('.btn-remove').on('click', removeDatetime);

    // not supported by api
    // $('#deadline_date').datetimepicker({
    //     format: 'YYYY-MM-DD',
    //     defaultDate: moment(),
    //     maxDate: moment().clone().add(1, 'years')
    // });

    $('#timeslot_duration').on('change', function(){
        updateTotalTimeSlots();
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

    let groups = await getGroupsInCategory();
        
    for(const group of groups){
        
        let data = group.Code.split('_');

        let startTime = moment.utc(data[0], 'YYYYMMDDHHmm').tz(TIMEZONE);
        let endTime = moment.utc(data[1], 'YYYYMMDDHHmm').tz(TIMEZONE);

        let localDateTimeFormat = startTime.format('MMM[&nbsp;]Do[&nbsp;]YYYY, h:mm[&nbsp;]A') + '&nbsp;-&nbsp;' + endTime.format('h:mm[&nbsp;]A');
        
        let timeslot = {
            start: startTime,
            end: endTime,
            name: localDateTimeFormat,
            groupId: group.GroupId,
            eventId: data[2],
            students: group.Enrollments
        };

        existingTimeSlots.push(timeslot);
    };
}

async function displayExistingTimeSlots(groupCategory){

    if(existingTimeSlots.length == 0){
        return false;
    }

    let duration = 0;

    let html = '<tr><th>Registration</th><th>Date & Time</th><th>Actions</th></tr>';

    $('#existing_timeslots__table').html(html);

    CLASSLIST = await CLASSLIST;

    existingTimeSlots.forEach(timeSlot => {
        
        let students = '';

        if(groupCategory.MaxUsersPerGroup > 0){
            students = '<span class="timeslot-student-count">' + timeSlot.students.length + '</span>/' + groupCategory.MaxUsersPerGroup + '<br />';
        }
            
        if(timeSlot.students.length > 0){
            for(let studentId of timeSlot.students){
                students += '<span id="student_' + studentId + '">' + CLASSLIST[studentId].DisplayName + ' (' + CLASSLIST[studentId].OrgDefinedId + ')<br /></span>';
            }

        } else if(groupCategory.MaxUsersPerGroup == 1) {
            students = '&nbsp;-&nbsp;';
        }

        if(duration == 0){
            duration = timeSlot.end.diff(timeSlot.start, 'minutes');
        }

        html = '<tr class="timeslot" id="timeslot_' + timeSlot.groupId + '">';
        html += '<td class="timeslot-registration">' + students + '</td>';
        html += '<td class="timeslot_datetime">' + timeSlot.name + '</td>';
        html += '<td class="timeslot_actions">';
        if(timeSlot.students.length > 0){
            if(groupCategory.MaxUsersPerGroup > 1)
                html += '<button class="btn btn-secondary btn-sm manage-timeslot" data-id="' + timeSlot.groupId + '">Cancel Registrations...</button> ';
            else
                html += '<button class="btn btn-secondary btn-sm manage-timeslot" data-id="' + timeSlot.groupId + '">Cancel Registration</button> ';
            
            html += '<br />'
        }
        html += '<button class="btn btn-red btn-sm delete-timeslot" data-id="' + timeSlot.groupId + '">Delete Time Slot</button></td>';
        html += '</td>';
        html += '</tr>';

        $('#existing_timeslots__table').append(html);
        
        if(groupCategory.MaxUsersPerGroup > 1)
            $('#existing_timeslots__table #timeslot_' + timeSlot.groupId).find('.manage-timeslot').on('click', function(){manageEnrollment(timeSlot.groupId)});
        else
            $('#existing_timeslots__table #timeslot_' + timeSlot.groupId).find('.manage-timeslot').on('click', function(){
                modalConfirm(
                    'Are you sure you cancel this registration?\n\nThe student will be removed and they will be able to select a different time.',
                    function(){cancelTimeSlot(timeSlot);}
                );
            });
        
        
        $('#existing_timeslots__table #timeslot_' + timeSlot.groupId).find('.delete-timeslot').on('click', function(){
            modalConfirm(
                'Are you sure you want to delete this time slot?\n\nIt will remove all registrations and associated events for this time.',
                function(){deleteTimeSlot(timeSlot)}
            );
        });
    });
    
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
    
    newTimeSlots = [];
    let totalTimeSlots = 0;
    let timeSlotDuration = 0;
    let totalTime = 0;

    // gave up total number of timeslots, kept the code just in case
    if(true){//($('#timeslot_unit_tabs').find('li.active').data('unit') == 'duration'){

        timeSlotDuration = parseInt($('#timeslot_duration').val());

        if(timeSlotDuration < 5){
            $('#total_timeslots').text('Please enter a time slot duration of at least 5 minutes.');
            return false;
        }

        timeBlocks.forEach(block => {
            totalTime += block.end.diff(block.start, 'minutes');

            let timeSlotsInBlock = parseInt(Math.floor(block.end.diff(block.start, 'minutes') / timeSlotDuration));

            for(let i = 0; i < timeSlotsInBlock; i++){
                let newTimeSlot = {
                    groupId: null,
                    eventId: null,
                    start: block.start.clone().add(i * timeSlotDuration, 'minutes'),
                    end: block.start.clone().add((i + 1) * timeSlotDuration, 'minutes'),
                };
                newTimeSlots.push(newTimeSlot);
            }

            totalTimeSlots += timeSlotsInBlock;
            
        });

    // total number was too hard to calculate, so just use the number of time slots in the first block
    } else {
        
        totalTimeSlots = parseInt($('#timeslot_number').val());

        let smallestTimeBlock = 0;
        let totalSmallestUnits = 0;

        timeBlocks.forEach(block => {
            let blockTime = block.end.diff(block.start, 'minutes');
            console.log(blockTime);
            if(smallestTimeBlock == 0 || blockTime < smallestTimeBlock){
                smallestTimeBlock = blockTime;
            }
        });

        console.log(smallestTimeBlock);

        timeBlocks.forEach(block => {
            let unitsInBlock = block.end.diff(block.start, 'minutes') / smallestTimeBlock;
            block.blockUnits = unitsInBlock;
            totalSmallestUnits += unitsInBlock;
        });

        console.log(totalSmallestUnits);

        let smallestBlockToTotal = totalSmallestUnits / totalTimeSlots;
        timeSlotDuration = smallestTimeBlock * smallestBlockToTotal;
        if(timeSlotDuration > smallestTimeBlock){
            timeSlotDuration = smallestTimeBlock;
        }

        totalTime = timeSlotDuration * totalTimeSlots;

    }

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
    newTimeSlots = [];
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

    datetimes.every(function(datetime1, i){
        if(datetime1.start.isAfter(datetime1.end) || datetime1.start.isSame(datetime1.end)){

            if(withErrors){
                modalMessage('Start time must be before end time.', $('#' + datetime1.id).find('select'));
            }
            valid = false;
            return false;
        
        } else {

            let spliceIndexes = [];

            let noOverlapWithBlocks = datetimes.slice(i + 1).every(function(datetime2, j){
                if(datetime1.id != datetime2.id && (
                    datetime1.start.isAfter(datetime2.start) && datetime1.start.isBefore(datetime2.end) || 
                    datetime1.end.isAfter(datetime2.start) && datetime1.end.isBefore(datetime2.end) ||
                    datetime2.start.isAfter(datetime1.start) && datetime2.start.isBefore(datetime1.end) || 
                    datetime2.end.isAfter(datetime1.start) && datetime2.end.isBefore(datetime1.end) ||
                    datetime1.start.isSame(datetime2.start) || datetime1.end.isSame(datetime2.end))){
                    
                    if(withErrors){
                        modalMessage('Datetimes must not overlap.', $('#' + datetime2.id).find(':input'));
                    }
                    valid = false;
                    return false;
                } else {

                    if(datetime1.end.isSame(datetime2.start)){
                        datetime1.end = datetime2.end.clone();
                        spliceIndexes.push(i + j + 1);
                    }

                    return true;
                }
            });

            if(noOverlapWithBlocks == false){
                return false;
            }

            let noOverlapWithSlots = existingTimeSlots.every(function(datetime2, j){
                
                if( datetime1.start.isAfter(datetime2.start) && datetime1.start.isBefore(datetime2.end) || 
                    datetime1.end.isAfter(datetime2.start) && datetime1.end.isBefore(datetime2.end) ||
                    datetime2.start.isAfter(datetime1.start) && datetime2.start.isBefore(datetime1.end) || 
                    datetime2.end.isAfter(datetime1.start) && datetime2.end.isBefore(datetime1.end) ||
                    datetime1.start.isSame(datetime2.start) || datetime1.end.isSame(datetime2.end)){
                    
                    if(withErrors){
                        modalMessage('New time ranges must not overlap with existing time slots.', $('#' + datetime1.id).find('.timeblock_datetime_input'));
                    }
                    valid = false;
                    return false;
                } else {

                    if(datetime1.end.isSame(datetime2.start)){
                        datetime1.end = datetime2.end.clone();
                        spliceIndexes.push(i + j + 1);
                    }

                    return true;
                }
            });

            if(noOverlapWithSlots == false){
                return false;
            }
            

            timeBlocks.push(datetime1);

            spliceIndexes.forEach(function(index){
                datetimes.splice(index, 1);
            });
            
            if(datetime1.end.isAfter(latestTime)){
                latestTime = datetime1.end.clone();
            }
            return true;
            
        }
    });

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

            console.log(result);
        }


        if(GROUP_CATEGORY_ID != null){

            let groupsInCategory = null;

            if(MODE == 'create'){
                groupsInCategory = await getGroupsInCategory();
            } else {

                promiseArray = [];

                for (timeSlot of existingTimeSlots){
                    promiseArray.push(updateCalendarEvent(timeSlot));
                }

                await Promise.all(promiseArray);
            }

            promiseArray = [];

            for(const [index,timeSlot] of newTimeSlots.entries()){

                let group = MODE == 'create' ? groupsInCategory[index] : false;
                
                promiseArray.push(createGroupAndEvent(timeSlot, group));

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

async function createGroupAndEvent(timeSlot, group){
    
    if(!group){
        group = await createGroup(timeSlot);
    }

    timeSlot.groupId = group.GroupId;
    
    let newEvent = await createCalendarEvent(timeSlot);
    
    timeSlot.eventId = newEvent.CalendarEventId;
    
    return await updateGroup(timeSlot);
    
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

    // DEADLINE NOT SUPPORTED BY API
    // TODO: SWITCH TO SUBMITTING FORM DATA
    // let format = "YYYY-MM-DD HH:mm";
    // let deadlineDate = $('#deadline_date').val();
    // let deadlineTime = $('#deadline_time').val();
    
    // let deadlineUTCDateTime = convertToUTCDateTimeString(moment(deadlineDate + " " + deadlineTime, format));

    let category = {
        "Name": title,
        "Description": {"Content": description, "Type":"Text"},
        "EnrollmentStyle": "PeoplePerNumberOfGroupsSelfEnrollment",
        "EnrollmentQuantity": null,
        "AutoEnroll": false,
        "RandomizeEnrollments": false,
        "NumberOfGroups": newTimeSlots.length,
        "MaxUsersPerGroup": maxUsers,
        "AllocateAfterExpiry": false,
        "SelfEnrollmentExpiryDate": null, //deadlineUTCDateTime, //<string:UTCDateTime>( yyyy-MM-ddTHH:mm:ss.fffZ )|null,
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
        // "EnrollmentStyle": "PeoplePerNumberOfGroupsSelfEnrollment",
        // "EnrollmentQuantity": null,
        "AutoEnroll": false,
        "RandomizeEnrollments": false,
        // "NumberOfGroups": null,
        // "MaxUsersPerGroup": maxUsers,
        // "AllocateAfterExpiry": false,
        // "SelfEnrollmentExpiryDate": null, //deadlineUTCDateTime, //<string:UTCDateTime>( yyyy-MM-ddTHH:mm:ss.fffZ )|null,
        // "GroupPrefix": null,
        // "RestrictedByOrgUnitId": null,
        "DescriptionsVisibleToEnrolees": true
    };
    
    return bs.put('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID, category);

}

function createGroup(timeSlot){
    
    let group = {
        "Name": timeSlot.start.format('MMM Do YYYY, h:mm A') + '-' + timeSlot.end.format('h:mm A'),
        "Code": "",
        "Description": { "Content": "", "Type": "Text" },
    }

    return bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/', group);
    
}

async function updateGroup(timeSlot){
    
    let group = {
        "Name": timeSlot.start.format('MMM Do YYYY, h:mm A') + '-' + timeSlot.end.format('h:mm A'),
        "Code": convertToUTCDateTimeString(timeSlot.start, true) + '_' + convertToUTCDateTimeString(timeSlot.end, true) + '_' + timeSlot.eventId,
        "Description": { "Content": "", "Type": "Text" }
    };

    return bs.put('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + timeSlot.groupId, group);
    
}

function createCalendarEvent(timeSlot){

    let event_title = $('#event_title').val().trim();
    if(event_title == ''){
        event_title = $('#title').val().trim();
    }

    let event = {
        "Title": event_title,
        "Description": "",
        "StartDateTime": convertToUTCDateTimeString(timeSlot.start),
        "EndDateTime": convertToUTCDateTimeString(timeSlot.end),
        "StartDay": null,
        "EndDay": null,
        "GroupId": timeSlot.groupId,
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

async function updateCalendarEvent(timeSlot){
    let event_title = $('#event_title').val().trim();
    if(event_title == ''){
        event_title = $('#title').val().trim();
    }

    let event = {
        "Title": event_title,
        "Description": "",
        "StartDateTime": convertToUTCDateTimeString(timeSlot.start),
        "EndDateTime": convertToUTCDateTimeString(timeSlot.end),
        "StartDay": null,
        "EndDay": null,
        "GroupId": timeSlot.groupId,
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

    return bs.put('/d2l/api/le/(version)/(orgUnitId)/calendar/event/' + timeSlot.eventId, event);
}


async function createTopic(){

    let title = $('#title').val().trim();

    let pluginPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/"));

    let orgUnitInfo = await bs.get('/d2l/api/lp/(version)/courses/(orgUnitId)');
    let targetModuleId = $('#module__select').val();
    let response = await fetch(pluginPath + '/resources/html/landing.tpl');
    let content = await response.text();
    content = content.replace(/\(pluginPath\)/g, pluginPath);
    content = content.replace(/\(groupCategoryId\)/g, GROUP_CATEGORY_ID);
    
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

async function deleteTimeSlot(timeSlot, requiresConfirmation = true){
    $('#timeslot_' + timeSlot.groupId).remove();

    await cancelTimeSlot(timeSlot, false);
    await deleteCalendarEvent(timeSlot.eventId);
    await deleteGroup(timeSlot.groupId);

    // remove timeSlot from existingTimeSlots
    existingTimeSlots = existingTimeSlots.filter(function( ets ) {
        return ets.groupId !== timeSlot.groupId;
    });
}

async function manageEnrollment(groupId){
    let group = await getGroup(groupId);
    
    let message = '<h3>Manage Registrations</h3>';

    let studentTable = '<div><table class="d2l-table" id="student_table"><thead><tr><th onclick="clickSubInput(event)"><input type="checkbox" class="select_all" onclick="selectAll(this)"></th><th>Student</th></tr></thead><tbody>';
    for(student of group.Enrollments){
        studentTable += '<tr><td onclick="clickSubInput(event)"><input type="checkbox" class="select_row" id="select_student_'+student+'" value="' + student + '"></td><td><label for="select_student_'+student+'">' + CLASSLIST[student].DisplayName + '</label></td></tr>';
    }
    studentTable += '</tbody></table></div>';

    message += studentTable;

    message += '<p style="margin-top:20px;"><input type="button" class="btn btn-red" value="Remove Selected" onclick="confirmRemoveStudentsFromGroup(' + groupId + ')"></p>';

    modalMessage(message);
}

function clickSubInput(e){
    if($(e.target).not('input')){
        $(e.target).find('input').click();
    }
}

function confirmRemoveStudentsFromGroup(groupId){
    modalConfirm(
        'Are you sure you cancel these registrations?\n\nThe selected students will be removed and they will be able to select a different time.',
        function(){removeStudentsFromGroup(groupId);}
    );
}

function removeStudentsFromGroup(groupId){
    //find the timeslot
    let timeSlot = existingTimeSlots.find(function( ets ) {
        return ets.groupId == groupId;
    });

    //remove the students from the group
    $('#student_table').find('.select_row').each(function(){
        if($(this).is(':checked')){
            let studentId = $(this).val();
            unenrolFromGroup(groupId, studentId);
            $(this).closest('tr').remove();
            $('#student_' + studentId).remove();
            timeSlot.students = timeSlot.students.filter(function( es ) {
                return es != parseInt(studentId);
            });
        }
    });

    if($('#student_table').find('.select_row').length == 0){
        $('#timeslot_' + groupId).find('.manage-timeslot').remove();
    }

    $('#timeslot_' + groupId).find('.timeslot-student-count').html(timeSlot.students.length);
}

async function cancelTimeSlot(timeSlot, requiresConfirmation = true){
    $('#timeslot_' + timeSlot.groupId + ' .timeslot-registration').html('&nbsp;-&nbsp;');
    $('#timeslot_' + timeSlot.groupId).find('.manage-timeslot').remove();
    let result = await unenrolFromGroup(timeSlot.groupId, timeSlot.student);
    timeSlot.student = false;
    return result;
}


function unenrolFromGroup(groupId, userId){
    let url = '/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + groupId + '/enrollments/' + userId;
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
    modalConfirm('Are you sure you want to delete this schedule?\n\nThis will remove all time slots and registrations.',
        function(){
            setTimeout(function(){
                modalConfirm('Are you really sure?\n\nThis will remove all time slots and registrations.',
                    function(){
                        deleteSchedule();
                    }
                );
            }, 555);
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