let bs = new Brightspace(orgUnitId);

let globalLatestTime = moment();
let existingTimeSlots = [];
let timeBlocks = [];
let timeSlots = [];
let totalTimeSlots = 0;

$(function() {
    setup();
});

function setup(){
    if(mode == 'edit'){ 
        getExistingTimeSlots().then(function(){
            timeSlots = existingTimeSlots.slice();
            displayExistingTimeBlocks();
            updateTotalTime();
            initializeDatetime( $('.datetime__div').first() );
        });
    } else {
        initializeDatetime( $('.datetime__div').first() );
        //showTimeblockEditor();
    }
}

async function getExistingTimeSlots(){
    await $.ajax({
        url: '/api/getExistingTimeBlocks',
        type: 'GET',
        dataType: 'json',
        beforeSend: function(headers){
            //headers.set('Authorization', await getAuthKey());
        },
        success: function(data){
            data.array.forEach(element => {
                existingTimeSlots.push(element);
            });
        }
    })
    
    return true;
}

function displayExistingTimeSlots(){

    let html = '';
    existingTimeSlots.forEach(element => {
        html += '<tr class="timeblock" id="timeBlock_' + element.id + '">';
        html += '<td class="timeblock_student">' + element.student + '</td>';
        html += '<td class="timeblock_starttime">' + element.starttime + '</td>';
        html += '<td class="timeblock_endtime">' + element.endtime + '</td>';
        html += '<td class="timeblock_actions">';
        if(element.student !== false){
            html += '<button class="btn btn-danger btn-sm cancel-timeblock" onclick="canelTimeBlock(' + element.id + ')" data-id="' + element.id + '">Cancel</button>';
        }
        html += '<button class="btn btn-danger btn-sm delete-timeblock" onclick="deleteTimeBlock(' + element.id + ')" data-id="' + element.id + '">Delete</button></td>';
        html += '</td>';
        html += '</tr>';
    });

    $('#existingTimeBlocks').html(html);
}

function cancelTimeBlock(id){
    unenrolFromGroup(id);
}

function deleteTimeBlock(id){
    unenrolFromGroup(id);
    deleteCalendarEvent(id);
    deleteGroup(id);
}

async function unenrolFromGroup(groupId,userId){
    
    bs.delete('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + groupCategoryId + '/groups/' + groupId + '/enrollments/' + userId);

}

function deleteCalendarEvent(eventId){
    
    bs.delete('/d2l/api/le/(version)/(orgUnitId)/calendar/event/' + eventId);

}

function deleteGroup(groupId){
    
    bs.delete('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + groupCategoryId + '/groups/' + groupId);
    
}

function addDatetime(){

    let lastDatetime = $('.datetime_div').last();
    let newDatetime = lastDatetime.clone();
    let newLength = $('.datetime_div').length + 1

    newDatetime.attr('id', 'datetime_' + newLength);
    newDatetime.find('h3').text('Date & Time ' + newLength);
    newDatetime.find('label.dateLabel').attr('for', 'date_' + newLength);
    newDatetime.find('label.starttimeLabel').attr('for', 'starttime_' + newLength);
    newDatetime.find('label.endtimeLabel').attr('for', 'endtime_' + newLength);
    
    newDatetime.find('input.dateInput').attr('id', 'date_' + newLength).attr('name', 'date_' + newLength).val('');
    newDatetime.find('input.starttimeInput').attr('id', 'starttime_' + newLength).attr('name', 'starttime_' + newLength).val('');
    newDatetime.find('input.endtimeInput').attr('id', 'endtime_' + newLength).attr('name', 'endtime_' + newLength).val('');
    
    newDatetime.insertAfter(lastDatetime);
    initializeDatetime($('.datetime_div').last());   // initialize the new datetime

}

function selectTab(obj){
    $('.tabs').find('li').removeClass('active');
    $(obj).parent().addClass('active');
    $('.tabs').find('div').removeClass('active');
    $('.tabs').find($(obj).attr('href')).addClass('active');
}

function updateTotalTime(){
    let totalTime = 0;
    $('.datetime_Span').each(function(){
        let time = $(this).text();
        if(time != ''){
            totalTime += parseInt(time);
        }
    });
    $('#totalTime').text('Total time: ' + totalTime + ' minutes');
    
    updateTotalTimeSlots();
}

function updateTotalTimeSlots(){
    totalTimeSlots = 0;
    let timeSlotDuration = parseInt($('#timeSlotDuration').val()); 
    
    console.log(timeSlotDuration);

    timeBlocks.forEach(block => {
        totalTimeSlots += parseInt(Math.floor(block.end.diff(block.start, 'minutes') / timeSlotDuration));
    });

    $('#totalTimeSlots').text('This will create ' + totalTimeSlots + ' meetings of ' + timeSlotDuration + ' minutes each.');
}

function initializeDatetime(datetimeElem){

    const now = moment();

    // if(globalLatestTime.hours() <= 22){
    //     globalLatestTime = globalLatestTime + moment.duration({hours:1});
    // } else {
    //     globalLatestTime = globalLatestTime + moment.duration({hours:9});
    // }

    $(datetimeElem).find('.dateInput').datetimepicker({
        format: 'YYYY-MM-DD',
        defaultDate: globalLatestTime,
        minDate: globalLatestTime,
        maxDate: moment().add(1, 'years')
    });

    $(datetimeElem).find('.starttimeInput').datetimepicker({
        format: 'LT',
        stepping: 15,
        defaultDate: globalLatestTime,
        minDate: moment().startOf('day'),
        maxDate: moment().add(1, 'hours')
    }).on('dp.hide', function(e){
        $(datetimeElem).find('.endtimeInput').data('DateTimePicker').minDate(e.date.add(15, 'minute'));
        validateTimeFields(false);
    });

    $(datetimeElem).find('.endtimeInput').datetimepicker({
        format: 'LT',
        stepping: 15,
        defaultDate: globalLatestTime + moment.duration({hours:1}),
        minDate: moment().subtract(1, 'hours'),
        maxDate: moment().endOf('day'),
    }).on('dp.hide', function(e){
        $(datetimeElem).find('.starttimeInput').data('DateTimePicker').maxDate(e.date.subtract(15, 'minute'));
        validateTimeFields(false);
    });

    validateTimeFields(false);

}

function updateGlobalLatestTime(newTime){
    
    if(newTime == globalLatestTime){
        if(globalLatestTime.hours() <= 22){
            globalLatestTime = globalLatestTime + moment.duration({days:1});
        } else {
            globalLatestTime = globalLatestTime + moment.hours({hours:9});
        }
    } else {
        if(newTime > globalLatestTime){
            globalLatestTime = newTime;
        }
    }
    
}

function errorMessage(message, id){
    
    if(typeof(id) == 'string')
        $('#' + id).addClass('error');
    else
        id.addClass('error');
    
    $('#messageModel').find('.modal-title').html('Error');
    $('#messageModal').find('.modal-body').html(message);
    $('#messageModal').modal('show');

}

function clearErrorMessage(id){
    $('#' + id).removeClass('error');
}


function validateTimeFields(withErrors){
    valid = true;
    timeSlots = [];
    timeBlocks = [];
    totalTimeSlots = 0;

    let datetimes = [];
    
    let latestTime = 0;

    let selectedTab = $('.tab-pane.active').find('label').attr('for');
    let blockValue = parseInt($('#' + selectedTab).val());

    $('.datetime_Div').each(function(){
        let datetime = {};
        let format = "YYYY-MM-DD hh:mm A";
        let date = $(this).find('.dateInput').val() + " ";
        datetime['id'] = $(this).attr('id');
        datetime['start'] = moment(date + $(this).find('.starttimeInput').val(), format);
        datetime['end'] = moment(date + $(this).find('.endtimeInput').val(), format);
        datetimes.push(datetime);
    });

    datetimes.sort(compareStarttime);

    datetimes.every(function(datetime1, i){
        if(datetime1['start'].isAfter(datetime1['end']) || datetime1['start'].isSame(datetime1['end'])){

            if(withErrors){
                errorMessage('Start time must be before end time.', $('#' + datetime1['id']).find('input'));
            }
            valid = false;
            return false;
        
        } else {

            let spliceIndexes = [];

            let noOverlap = datetimes.slice(i + 1).every(function(datetime2, j){
                if(datetime1['id'] != datetime2['id'] && (
                    datetime1['start'].isAfter(datetime2['start']) && datetime1['start'].isBefore(datetime2['end']) || 
                    datetime1['end'].isAfter(datetime2['start']) && datetime1['end'].isBefore(datetime2['end']) ||
                    datetime1['start'].isSame(datetime2['start']) || datetime1['end'].isSame(datetime2['end']))){
                    
                    if(withErrors){
                        errorMessage('Datetimes must not overlap.', $('#' + datetime2['id']).find('input'));
                    }
                    valid = false;
                    return false;
                } else {

                    if(datetime1['end'].isSame(datetime2['start'])){
                        datetime1['end'] = datetime2['end'];
                        spliceIndexes.push(i + j + 1);
                    }

                    return true;
                }
            });

            if(noOverlap == false){
                return false;
            } else {

                timeBlocks.push(datetime1);

                spliceIndexes.forEach(function(index){
                    datetimes.splice(index, 1);
                });
                
                if(datetime1['end'].isAfter(latestTime)){
                    latestTime = datetime1['end'];
                }
                return true;
            }
        }
    });

    if(blockValue == ''){
        $('#' + selectedTab).addClass('error');
        valid = false;
        return false;
    }

    if(valid){
        updateTotalTimeSlots();
    }

    updateGlobalLatestTime(latestTime);

}

function compareStarttime(a, b){
    if(a['start'].isBefore(b['start'])){
        return -1;
    } else if(a['start'].isAfter(b['start'])){
        return 1;
    } else {
        return 0;
    }
}


function validateAllFields(){

    $('input').removeClass('error');

    let valid = true;

    let title = $('#title').val();
    

    if(title == ''){
        $('#title').addClass('error');
        valid = false;
        return false;
    }
    
    validateTimeFields(true);

}

function updateTimeSlots(timeBlock){
    let duration = timeBlock['end'] - timeBlock['start'];
    let slotsPerBlock = Math.floor(duration.asMinutes() / timeBlockSize);
    totalTimeSlots += slotsPerBlock;
    for(i = 0; i < slotsPerBlock; i++){
        let time ={
            'start' : timeBlock['start'].add(i * timeBlockSize, 'minutes'),
            'end' : timeBlock['start'].add((i + 1) * timeBlockSize, 'minutes')
        }
        timeSlots.push(time);
    }

    console.log(timeSlots);
    
//     $('#' + timeBlock['id']).find('.totalTime').html(totalTime.format('HH:mm'));
//     $('#' + timeBlock['id']).find('.totalBlocks').html();
}

async function submit(){

    if(mode == 'create'){
        let groupCategory = await createGroupCategory();
        groupCategoryId = groupCategory.groupCategoryId;
    }

    if(groupCategoryId != null){
        newTimeSlots.forEach(function(timeSlot){
            let groupId = createGroup(timeSlot);
            if(groupId != null){
                timeSlot['groupId'] = groupId;
                createCalendarEvent(timeSlot);
            }
        });
    }
}

function createGroupCategory(){
    
    let title = $('#title').val();
    let description = $('#description').val();
    let numGroups = totalTimeSlots;
    let deadlineUTCDateTime = $('#deadlineUTCDateTime').val();

    let category = {
        "Name": title,
        "Description": {"Content": description, "Type":"Html"}, //{"Content": <string>,"Type": "Text|Html"}
        "EnrollmentStyle": 4, //SelfEnrollmentNumberOfGroups
        //"EnrollmentQuantity": <number>|null,
        "AutoEnroll": false,
        "RandomizeEnrollments": false,
        "NumberOfGroups": numGroups,
        "MaxUsersPerGroup": 1,
        "AllocateAfterExpiry": false,
        "SelfEnrollmentExpiryDate": deadlineUTCDateTime, //<string:UTCDateTime>( yyyy-MM-ddTHH:mm:ss.fffZ )|null,
        //"GroupPrefix": <string>|null,
        //"RestrictedByOrgUnitId": <number:D2LID>|null,
        "DescriptionsVisibleToEnrolees": true  // Added with LP API version 1.42
    };
    
    let result = bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/', category);

    return result;
}

function setGroupName(timeSlot){
    
    let group = {
        "Name": timeSlot['start'].format('MMMM D, YYYY | h:mma') + ' - ' + timeSlot['end'].format('HH:MM'),
        "Code": "",
        "Description": { "Content": "", "Type": "Html" },
    }

    bs.put('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + groupCategoryId + '/groups/' + timeSlot['groupId'], group);
    
}

function createGroup(timeSlot){
    let group = {
        "Name": timeSlot['start'].format('MMMM D, YYYY | h:mma') + ' - ' + timeSlot['end'].format('HH:MM'),
        "Code": "",
        "Description": { "Content": "", "Type": "Html" },
    }

    let result = bs.post('/d2l/api/lp/(version)/(orgUnitId)/groupcategories/' + groupCategoryId + '/groups/', group);

    return result;
}

function createCalendarEvent(timeSlot){

    let event = {
        "Title": title,
        "Description": "",
        "StartDateTime": convertToUTC(timeSlot['start']),
        "EndDateTime": convertToUTC(timeSlot['end']),
        //"StartDay": <string:LocalDateTime>|null,
        //"EndDay": <string:LocalDateTime>|null,
        "GroupId": timeSlot['groupId'],
        "RecurrenceInfo": {
            "RepeatType": 2,
            "RepeatEvery": 1,
            "RepeatOnInfo": {
                "Monday": false,
                "Tuesday": false,
                "Wednesday": false,
                "Thursday": false,
                "Friday": false,
                "Saturday": false,
                "Sunday": false
            },
            "RepeatUntilDate": convertToUTCDateTime(timeSlot['end'])
        },
        //"LocationId": <number:D2LID>|null,
        "LocationName": "",
        //"AssociatedEntity": { <composite:Calendar.AssociatedEntity> },
        "VisibilityRestrictions": {
            "Type": 1,
            // "Range": <number>|null,
            // "HiddenRangeUnitType": <number:HIDDENUNITT>|null,
            // "StartDate": <string:UTCDateTime>|null,
            // "EndDate": <string:UTCDateTime>|null,
        }
    };

    let result = bs.post('/d2l/api/lp/(version)/(orgUnitId)/calendar/event/', event);

    return result;
}

function loading(){
    $('.main').children().toggle();
    $('#loading').toggle();
}

function convertToUTCDateTime(date){

    var nowUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(),
                date.getUTCDate(), date.getUTCHours(),
                date.getUTCMinutes(), date.getUTCSeconds());

    console.log(nowUtc.toISOString());
    console.log(nowUtc.format('YYYY-MM-DDTHH:mm:ss.fff') + 'Z');

    return nowUtc.format('YYYY-MM-DDTHH:mm:ss.fff') + 'Z';

}