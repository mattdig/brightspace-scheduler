let match = window.top.location.href.match(/\/navbars\/(\d+)\//);
let ORG_UNIT_ID = match[1];
const bs = new Brightspace(ORG_UNIT_ID);
const params = new Proxy(new URLSearchParams(window.top.location.search), {get: (searchParams, prop) => searchParams.get(prop)});
let CFG = params.cfg;
let MODE = 'create';
if(CFG !== null){
    CFG = JSON.parse(atob(CFG));
    MODE = 'edit';
}
let GROUP_CATEGORY_ID = (MODE == 'edit' ? CFG.gc : null);
let TOPIC_ID = 0;
let TOPIC;
let SUBMITTING = false;
let TIMEZONE;
let CLASSLIST;
let TITLE;
let ORG_INFO = bs.get('/d2l/api/lp/(version)/organization/info');
let COURSE = bs.get('/d2l/api/lp/(version)/courses/' + ORG_UNIT_ID);
let GROUPS = (MODE == 'edit' ? getGroupsInCategory() : null);
let USER = whoAmI();

let timeBlocks = [];
let existingTimeSlots = [];
let newTimeSlots = [];

$(function(){init();});

async function init(){

    let associatedGroups = false;
    if(MODE == 'edit'){

        TOPIC_ID = CFG.t;

        TOPIC = bs.get('/d2l/api/le/(version)/(orgUnitId)/content/topics/' + TOPIC_ID);
        
        associatedGroups = getGroupsInCategory(CFG.agc);
    }

    const promises = await Promise.all([
        ORG_INFO,
        COURSE,
        GROUPS, 
        bs.get('/d2l/api/lp/(version)/' + ORG_UNIT_ID + '/groupcategories/'), 
        associatedGroups,
        USER
    ]);

    ORG_INFO = promises[0];
    COURSE = promises[1];
    GROUPS = promises[2];
    let otherGroupCategories = promises[3];
    associatedGroups = promises[4];
    USER = promises[5];

    let isTA = false;
    let myEnrollment = await bs.get('/d2l/api/lp/(version)/enrollments/orgUnits/' + ORG_UNIT_ID + '/users/' + USER.Identifier);

    // Uses IMS defined roles
    if('Errors' in myEnrollment || TEACHING_ASSISTANT_ROLE_IDS.includes(myEnrollment.RoleId)){
        isTA = true;
    }
    
    TIMEZONE = ORG_INFO.TimeZone;

    moment.tz.setDefault(TIMEZONE);

    for(const og of otherGroupCategories){
        $('#associated_group_category').append($('<option>', {value: og.GroupCategoryId, text: og.Name}));
    }

    if(MODE == 'edit'){

        CLASSLIST = getClassList();

        $('#form_title').html('Edit Signup Schedule');

        let groupCategory = await getGroupCategory();
        TITLE = groupCategory.Name;
        $('#title').val(TITLE);
        $('#schedule_title').html(groupCategory.Name);

        
        if('dr' in CFG && CFG.dr == 1){
            $('#deregister_yes').prop('checked', true);
        } else {
            $('#deregister_no').prop('checked', true);
        }


        if('ei' in CFG && CFG.ei == 1){
            $('#email_instructor_yes').prop('checked', true);
        } else {
            $('#email_instructor_no').prop('checked', true); 
        }
        

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
            $('#autofill_group_registration__buton').click(async function(){
                $(this).prop('disabled', true);
                await autofillGroupRegistration(associatedGroups);
                $(this).prop('disabled', false);
            });
        }

        // wait for the classlist to load
        CLASSLIST = await CLASSLIST;

        await getExistingTimeSlots();
        let calendarEvent = await bs.get('/d2l/api/le/(version)/(orgUnitId)/calendar/event/' + existingTimeSlots[0].eventId);
        $('#event_title').val(calendarEvent.Title);
        
        await displayExistingTimeSlots(groupCategory);

        $('#add_new_timeblocks').show();

        $('#edit_schedule').show();

    } else {
        $('#form_title').html('Create New Signup Schedule');
        $('#deregister_no').prop('checked', true);
        $('#email_instructor_no').prop('checked', true);
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
    
    let promiseArray = [];

    for(i in GROUPS){
        
        let data = GROUPS[i].Code.split('_');

        let startTime = moment.utc(data[0], 'YYYYMMDDHHmm').tz(TIMEZONE);
        let endTime = moment.utc(data[1], 'YYYYMMDDHHmm').tz(TIMEZONE);

        let localDateTimeFormat = startTime.format('MMM[&nbsp;]Do[&nbsp;]YYYY, h:mm[&nbsp;]A') + '&nbsp;-&nbsp;' + endTime.format('h:mm[&nbsp;]A');

        if(CFG.dr !== undefined && CFG.dr == 1){
            if(endTime < moment()){
                for(const userId of GROUPS[i].Enrollments){
                    promiseArray.push(unenrollFromGroup(GROUPS[i].GroupId, userId, false));
                }
                GROUPS[i].Enrollments = [];
            }
        }
        
        // Brightspace includes unenrolled students in the groups, so they need to be filtered out
        if(GROUPS[i].Enrollments.length > 0)
            GROUPS[i].Enrollments = GROUPS[i].Enrollments.filter(userId => userId in CLASSLIST);

        let timeslot = {
            start: startTime,
            end: endTime,
            name: localDateTimeFormat,
            groupId: GROUPS[i].GroupId,
            eventId: data[2],
            students: GROUPS[i].Enrollments
        };

        existingTimeSlots.push(timeslot);
    };

    if(promiseArray.length > 0){
        await Promise.all(promiseArray);
    }

    existingTimeSlots.sort(compareStarttime);
}

async function displayExistingTimeSlots(groupCategory){

    if(existingTimeSlots.length == 0){
        return false;
    }

    let duration = 0;

    let html = '<tr><th>Registration</th><th>Date & Time</th><th>Actions</th></tr>';

    $('#existing_timeslots__table').html(html);

    let hasRegistrations = false;

    existingTimeSlots.forEach(timeSlot => {
        
        if(!hasRegistrations && timeSlot.students.length > 0){
            hasRegistrations = true;
        }

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

        html += '<button class="btn btn-secondary btn-sm enrollStudents" data-id="' + timeSlot.groupId + '">Add Registrations</button>';
        
        if(timeSlot.students.length > 0){
            if(groupCategory.MaxUsersPerGroup > 1)
                html += '<button class="btn btn-secondary btn-sm unenrollStudents" data-id="' + timeSlot.groupId + '">Cancel Registrations</button>';
            else
                html += '<button class="btn btn-secondary btn-sm unenrollStudents" data-id="' + timeSlot.groupId + '">Cancel Registration</button>';
        }
        html += '<button class="btn btn-red btn-sm delete-timeslot" data-id="' + timeSlot.groupId + '">Delete Time Slot</button></td>';
        html += '</td>';
        html += '</tr>';

        $('#existing_timeslots__table').append(html);
        
        $('#existing_timeslots__table #timeslot_' + timeSlot.groupId).find('.enrollStudents').on('click', function(){manageEnrollment('add', timeSlot.groupId)});

        if(timeSlot.students.length > 1)
            $('#existing_timeslots__table #timeslot_' + timeSlot.groupId).find('.unenrollStudents').on('click', function(){manageEnrollment('remove', timeSlot.groupId)});
        else
            $('#existing_timeslots__table #timeslot_' + timeSlot.groupId).find('.unenrollStudents').on('click', function(){
                modalConfirm(
                    'Are you sure you cancel this registration?<br />The student will be removed and they will be able to select a different time.',
                    function(){cancelTimeSlot(timeSlot);}
                );
            });
        
        
        $('#existing_timeslots__table #timeslot_' + timeSlot.groupId).find('.delete-timeslot').on('click', function(){
            modalConfirm(
                'Are you sure you want to delete this time slot?<br />It will remove all registrations and associated events for this time.',
                function(){deleteTimeSlot(timeSlot)}
            );
        });
    });

    if(hasRegistrations){
        $('#download_schedule').show();
        if('agc' in CFG){
            $('#autofill_group_registration').show();
        }
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

        newDateTime.find('.day_of_week').prop('checked', false);
        
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
        
        elem.find('label.timeslottype_single_label').attr('for', 'timeslottype_single_' + index);
        elem.find('input.timeslottype_single_input').attr('id', 'timeslottype_single_' + index).attr('name', 'timeslottype_' + index);

        elem.find('label.timeslottype_recurring_label').attr('for', 'timeslottype_recurring_' + index);
        elem.find('input.timeslottype_recurring_input').attr('id', 'timeslottype_recurring_' + index).attr('name', 'timeslottype_' + index);
        
        elem.find('label.startdate_label').attr('for', 'date_' + index);
        elem.find('label.enddate_label').attr('for', 'enddate_' + index);
        elem.find('label.starttime_label').attr('for', 'starttime_' + index);
        elem.find('label.endtime_label').attr('for', 'endtime_' + index);
        
        elem.find('input.startdate_input').attr('id', 'date_' + index).attr('name', 'date_' + index);
        elem.find('input.enddate_input').attr('id', 'enddate_' + index).attr('name', 'enddate_' + index);
        elem.find('select.starttime_input').attr('id', 'starttime_' + index).attr('name', 'starttime_' + index);
        elem.find('select.endtime_input').attr('id', 'endtime_' + index).attr('name', 'endtime_' + index);

        elem.find('label.monday_label').attr('for', 'monday_' + index);
        elem.find('label.tuesday_label').attr('for', 'tuesday_' + index);
        elem.find('label.wednesday_label').attr('for', 'wednesday_' + index);
        elem.find('label.thursday_label').attr('for', 'thursday_' + index);
        elem.find('label.friday_label').attr('for', 'friday_' + index);
        elem.find('label.saturday_label').attr('for', 'saturday_' + index);
        elem.find('label.sunday_label').attr('for', 'sunday_' + index);

        elem.find('input.day_of_week__0').attr('id', 'sunday_' + index).attr('name', 'sunday_' + index);
        elem.find('input.day_of_week__1').attr('id', 'monday_' + index).attr('name', 'monday_' + index);
        elem.find('input.day_of_week__2').attr('id', 'tuesday_' + index).attr('name', 'tuesday_' + index);
        elem.find('input.day_of_week__3').attr('id', 'wednesday_' + index).attr('name', 'wednesday_' + index);
        elem.find('input.day_of_week__4').attr('id', 'thursday_' + index).attr('name', 'thursday_' + index);
        elem.find('input.day_of_week__5').attr('id', 'friday_' + index).attr('name', 'friday_' + index);
        elem.find('input.day_of_week__6').attr('id', 'saturday_' + index).attr('name', 'saturday_' + index);

    });

    return element;
}

function initializeDatetime(datetimeElem){

    let latestTime = moment();
    let initializeTimes = true;

    $(datetimeElem).find('.timeslottype').on('change', function(){
        if($(this).val() == 'recurring' && $(this).is(':checked')){
            $(datetimeElem).find('label.startdate_label p').text('Start Date');
            $(datetimeElem).find('.day_checkboxes').show();
            $(datetimeElem).find('.startdate').removeClass('col-sm-6').addClass('col-sm-3');
            $(datetimeElem).find('.enddate').show();
        } else {
            $(datetimeElem).find('label.startdate_label p').text('Date');
            $(datetimeElem).find('.day_checkboxes').hide();
            $(datetimeElem).find('.startdate').removeClass('col-sm-3').addClass('col-sm-6');
            $(datetimeElem).find('.enddate').hide();
        }

        validateTimeFields(false);
    });

    if($('.datetime__div').length > 1){

        initializeTimes = false;
        
        $('.datetime__div').each(function(){
            let datetime;
            if($(this).find('.timeslottype_recurring_input').is(':checked')){
                datetime = moment($(this).find('.enddate_input').val() + ' ' + $(this).find('.starttime_input').val(), 'YYYY-MM-DD HH:mm');                
            } else {
                datetime = moment($(this).find('.startdate_input').val() + ' ' + $(this).find('.starttime_input').val(), 'YYYY-MM-DD HH:mm');
            }

            if(datetime.isAfter(latestTime)){
                latestTime = datetime;
            }
        });
        
        latestTime.add(1, 'days');
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
    }).on('dp.change', function(){
        validateTimeFields(false);
    });

    if(initializeTimes){
        latestTime = momentFromTime(latestTime.format('HH:mm'));
    
        let minTime = momentFromTime('00:00');
        maxTime = momentFromTime('23:30');

        generateTimeOptions($(datetimeElem).find('.starttime_input'), latestTime, minTime, maxTime, interval);

        generateTimeOptions($(datetimeElem).find('.endtime_input'), latestTime.add(1, 'hours'), minTime, maxTime.add(29, 'minutes'), interval);
    }

    $(datetimeElem).find('.timeblock_datetime_input').on('change', function(){
        validateTimeFields(false);
    });

    $(datetimeElem).find('.day_of_week').on('change', function(){
        validateTimeFields(false);
    });
    
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
    
    if($('#edit_timeblocks').is(':visible')){
        $('.datetime__div').each(function(){

            let dateFormat = 'YYYY-MM-DD';
            let timeFormat = 'HH:mm';
            let format = dateFormat + ' ' + timeFormat;

            let startdate = $(this).find('.startdate_input').val();
            let enddate = $(this).find('.enddate_input').val();

            let isRecurring = $(this).find('.timeslottype_recurring_input').is(':checked');

            if(startdate == '' || enddate == ''){
                if(withErrors){
                    modalMessage('Please enter a start ' + (isRecurring ? 'and end ' : '') + 'date.', $(this).find('.date_input'));
                }
                return false;
            }

            if(isRecurring){

                let startdateMoment = moment(startdate, dateFormat);
                let enddateMoment = moment(enddate, dateFormat);

                let dayDifference = enddateMoment.diff(startdateMoment, 'days');

                if(startdateMoment.isAfter(enddateMoment)){
                    if(withErrors){
                        modalMessage('End date must be after start date.', $(this).find('.date_input'));
                    }
                    return false;
                } else if (dayDifference > 365){
                    if(withErrors){
                        modalMessage('Date range must be less than 1 year.', $(this).find('.date_input'));
                    }
                    return false;
                }

                let date = startdate + ' ';
                let starttime = $(this).find('.starttime_input').val();
                let endtime = $(this).find('.endtime_input').val();

                let startdatetime = moment(date + starttime, format);
                let enddatetime = date + endtime;

                for(i = 0; i <= dayDifference; i++){
                                        
                    // if the day of the week is selected
                    if($(this).find('.day_of_week__' + startdatetime.day() + ':checked').length > 0){
                        let datetime = {};
                        datetime.id = $(this).attr('id');
                        datetime.start = startdatetime.clone();
                        datetime.end = moment(enddatetime, format).add(i, 'days');
                        datetimes.push(datetime);
                    }

                    startdatetime.add(1, 'days');
                }

            } else {

                let datetime = {};
                let date = $(this).find('.startdate_input').val() + " ";

                datetime.id = $(this).attr('id');
                datetime.start = moment(date + $(this).find('.starttime_input').val(), format);
                datetime.end = moment(date + $(this).find('.endtime_input').val(), format);
                datetimes.push(datetime);

            }

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
            
        }
    }

    if(!updateTotalTimeSlots() && $('#edit_timeblocks').is(':visible') && withErrors){
        modalMessage('No new time slots will be created. Please adjust your time ranges or duration.');
        valid = false;
    }
    
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
        let refreshCFG = false;

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

            if(
                $('#deregister_yes').is(':checked') && (!('dr' in CFG) || CFG.dr == 0) ||
                $('#deregister_no').is(':checked') && 'dr' in CFG && CFG.dr == 1 ||
                $('#email_instructor_yes').is(':checked') && (!('ei' in CFG) || CFG.ei == 0) ||
                $('#email_instructor_no').is(':checked') && 'ei' in CFG && CFG.ei == 1
            ){
                await updateTopicFile(result[1]);
                refreshCFG = true;
            }
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

        
        reloadAfterSave(refreshCFG);

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

function reloadAfterSave(refreshCFG){
    if(MODE == 'create' || refreshCFG){
        window.top.location.replace('/d2l/le/content/' + ORG_UNIT_ID + '/viewContent/' + TOPIC_ID + '/View');
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
        "NumberOfGroups": newTimeSlots.length,
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


async function createTopic(doCreate = true){

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
    }

    if($('#deregister_yes').is(':checked')){
        configOptionsJSON.dr = 1;
    }

    if($('#email_instructor_yes').is(':checked')){
        configOptionsJSON.ei = 1;
    }

    content = content.replace(/\(configOptionsJSON\)/g, JSON.stringify(configOptionsJSON));

    if(!doCreate){
        return content;
    }
    
    let topicObj = [
        {
            "IsHidden": false,
            "IsLocked": false,
            "ShortTitle": 'Hello',
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
    
    return bs.post('/d2l/api/le/(version)/(orgUnitId)/content/modules/' + targetModuleId + '/structure/?renameFileIfExists=true', topicObj);
    
}

async function updateTopic(){

    TOPIC = await TOPIC;

    let title = $('#title').val().trim();

    topicObj = {
        "Title": title,
        "ShortTitle": "",
        "Type": 1,
        "TopicType": 1,
        "Url": TOPIC.Url,
        "IsHidden": TOPIC.IsHidden,
        "IsLocked": TOPIC.IsLocked,
        "MajorUpdateText": ""
    }

    await bs.put('/d2l/api/le/(version)/(orgUnitId)/content/topics/' + TOPIC_ID, topicObj);

    return topicObj;

}

async function updateTopicFile(){

    let content = await createTopic(false);

    let filename = TOPIC.Url.substring(TOPIC.Url.lastIndexOf('/') + 1);

    let formdata  = 'Content-Disposition:form-data;name="file";filename="' + filename + '"\r\n';
        formdata += 'Content-Type:text/html; charset="UTF-8"\r\n\r\n';
        formdata += content + '\r\n';

    await bs.put("/d2l/api/le/(version)/(orgUnitId)/content/topics/" + TOPIC_ID + "/file", [formdata]);

    await bs.delete('/d2l/api/lp/(version)/(orgUnitId)/managefiles/file?path=' + encodeURIComponent(TOPIC.Url));
        
    return true;

}

async function deleteTimeSlot(timeSlot, sendNotifications = true){
    $('#timeslot_' + timeSlot.groupId).remove();
    let promises = [];
    promises.push(deleteCalendarEvent(timeSlot.eventId));
    for(student of timeSlot.students){
        promises.push(unenrollFromGroup(timeSlot.groupId, student, sendNotifications));
    }
    await Promise.all(promises);
    let deleted = await deleteGroup(timeSlot.groupId);

    // remove timeSlot from existingTimeSlots
    existingTimeSlots = existingTimeSlots.filter(function(ets) {
        return ets.groupId !== timeSlot.groupId;
    });

    if(sendNotifications){
        reloadAfterSave();
    } else {
        return deleted;
    }
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
            if(STUDENT_ROLE_IDS.includes(student.RoleId)){
                isStudent = true;

                for(g of GROUPS){
                    if(g.Enrollments.length > 0 && g.Enrollments.includes(student.Identifier)){
                        inGroup = true;
                        break;
                    }
                }
            }

            return isStudent && !inGroup;
        });

        studentTable += '<th>&nbsp;</th>';
    } else {
        let group = await getGroup(groupId);

        for(student of group.Enrollments){
            if(CLASSLIST[student] != undefined)
                studentList.push(CLASSLIST[student]);
        }

        studentTable += '<th onclick="clickSubInput(event)"><input type="checkbox" class="select_all" onclick="selectAll(this)"></th>';
    }

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

    //find the timeslot
    let timeSlot = existingTimeSlots.find(function(ets) {
        return ets.groupId == groupId;
    });

    let promises = [];

    //remove the students from the group
    checkedStudents.each(function(){
        let studentId = this.value;
        promises.push(unenrollFromGroup(groupId, studentId));
        $('#student_' + studentId).remove();
        timeSlot.students = timeSlot.students.filter(function(id) {
            return id != parseInt(studentId);
        });
    });

    if(timeSlot.students.length == 0){
        $('#timeslot_' + groupId).find('.manage-timeslot').hide();
    }

    $('#timeslot_' + groupId).find('.timeslot-student-count').html(timeSlot.students.length);

    await Promise.all(promises);

    reloadAfterSave();

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

            // groups still contain unenrolled students
            if(student in CLASSLIST){

                if(groupEnrolledStudents[student]){
                    studentsAlreadyEnrolled.push(student);
                } else {
                    studentsToEnroll.push(student);
                }
            
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

async function cancelTimeSlot(timeSlot){
    $('#timeslot_' + timeSlot.groupId + ' .timeslot-registration').html('&nbsp;-&nbsp;');
    $('#timeslot_' + timeSlot.groupId).find('.manage-timeslot').remove();
    await unenrollFromGroup(timeSlot.groupId, timeSlot.students[0]);
    timeSlot.students = [];
    
    reloadAfterSave();
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

function unenrollFromGroup(groupId, userId, sendNotifications = true){
    let url = '/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + GROUP_CATEGORY_ID + '/groups/' + groupId + '/enrollments/' + userId;
    if(sendNotifications){
        notifyOfCancellation(userId);
    }

    //remove the student from group.Enrollment in GROUPS
    if(sendNotifications){
        let group = GROUPS.find(function(g) {
            return g.GroupId == groupId;
        });

        if(group != undefined){
            group.Enrollments = group.Enrollments.filter(function(id) {
                return id != userId;
            });
        }
    }

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

    window.top.location.replace('/d2l/le/content/' + ORG_UNIT_ID + '/Home');
}

function downloadSchedule(){

    let filename = 'schedule-grades.csv';
    let lines = ['Last Name,First Name,Email,Time Slot,OrgDefinedId,"' + TITLE + ' Points Grade",End-of-Line Indicator'];

    for(group of GROUPS){
        for(student of group.Enrollments){
            let line = [];
            line.push(CLASSLIST[student].LastName, CLASSLIST[student].FirstName, CLASSLIST[student].Email, '"' + group.Name + '"', CLASSLIST[student].OrgDefinedId, '','#');
            lines.push(line.join(','));
        }
    }

    if(lines.length > 1){
        let csv = lines.join('\n');

        download(filename, 'text/csv', csv);
    }
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