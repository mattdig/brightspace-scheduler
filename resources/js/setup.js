let auth_key = false;
let global_latest_time = moment();
let existing_time_slots = [];
let time_blocks = [];
let time_slots = [];
let total_time_slots = 0;

$(function() {
    setup();
});

function setup(){
    if(mode == 'edit'){ 
        get_existing_time_slots().then(function(){
            time_slots = existing_time_slots.slice();
            display_existing_time_blocks();
            update_total_time();
            initialize_datetime( $('.datetime__div').first() );
        });
    } else {
        initialize_datetime( $('.datetime__div').first() );
        //show_timeblock_editor();
    }
}

async function get_existing_time_slots(){
    await $.ajax({
        url: '/api/get_existing_time_blocks',
        type: 'GET',
        dataType: 'json',
        beforeSend: function(headers){
            //headers.set('Authorization', await get_auth_key());
        },
        success: function(data){
            data.array.forEach(element => {
                existing_time_slots.push(element);
            });
        }
    })
    
    return true;
}

function display_existing_time_slots(){

    let html = '';
    existing_time_slots.forEach(element => {
        html += '<tr class="time_block" id="time_block_' + element.id + '">';
        html += '<td class="time_block__student">' + element.student + '</td>';
        html += '<td class="time_block__starttime">' + element.starttime + '</td>';
        html += '<td class="time_block__endtime">' + element.endtime + '</td>';
        html += '<td class="time_block__actions">';
        if(element.student !== false){
            html += '<button class="btn btn-danger btn-sm cancel_time_block" onclick="canel_time_block(' + element.id + ')" data-id="' + element.id + '">Cancel</button>';
        }
        html += '<button class="btn btn-danger btn-sm delete_time_block" onclick="delete_time_block(' + element.id + ')" data-id="' + element.id + '">Delete</button></td>';
        html += '</td>';
        html += '</tr>';
    });

    $('#existing_time_blocks').html(html);
}

function cancel_time_block(id){
    unenrol_from_group(id);
}

function delete_time_block(id){
    unenrol_from_group(id).then(function(){
        delete_calendar_event(id).then(function(){
            delete_group(id);
        })
    });
}

async function unenrol_from_group(id){
    await $.ajax({
        url: '/api/unenrol_from_group',
        type: 'POST',
        dataType: 'json',
        data: {
            id: id
        },
        success: function(data){
            $('#registration_' + id).html('Empty');
        }
    });

    return true;
}

async function delete_calendar_event(id){
    await $.ajax({
        url: '/api/delete_calendar_event',
        type: 'POST',
        dataType: 'json',
        data: {
            id: id
        }
    });

    return true;
}

async function delete_group(id){
    await $.ajax({
        url: '/api/delete_group',
        type: 'POST',
        dataType: 'json',
        data: {
            id: id
        },
        success: function(data){
            $('#time_block_' + id).remove();
        }
    });

    return;
}

function add_datetime(){

    let last_datetime = $('.datetime__div').last();
    let new_datetime = last_datetime.clone();
    let new_length = $('.datetime__div').length + 1

    new_datetime.attr('id', 'datetime_' + new_length);
    new_datetime.find('h3').text('Date & Time ' + new_length);
    new_datetime.find('label.date_label').attr('for', 'date_' + new_length);
    new_datetime.find('label.starttime_label').attr('for', 'starttime_' + new_length);
    new_datetime.find('label.endtime_label').attr('for', 'endtime_' + new_length);
    
    new_datetime.find('input.date_input').attr('id', 'date_' + new_length).attr('name', 'date_' + new_length).val('');
    new_datetime.find('input.starttime_input').attr('id', 'starttime_' + new_length).attr('name', 'starttime_' + new_length).val('');
    new_datetime.find('input.endtime_input').attr('id', 'endtime_' + new_length).attr('name', 'endtime_' + new_length).val('');
    
    new_datetime.insertAfter(last_datetime);
    initialize_datetime($('.datetime__div').last());   // initialize the new datetime

}

function select_tab(obj){
    $('.tabs').find('li').removeClass('active');
    $(obj).parent().addClass('active');
    $('.tabs').find('div').removeClass('active');
    $('.tabs').find($(obj).attr('href')).addClass('active');
}

function update_total_time(){
    let total_time = 0;
    $('.datetime__span').each(function(){
        let time = $(this).text();
        if(time != ''){
            total_time += parseInt(time);
        }
    });
    $('#total_time').text('Total time: ' + total_time + ' minutes');
    
    update_total_time_slots();
}

function update_total_time_slots(){
    total_time_slots = 0;
    let time_slot_duration = parseInt($('#time_slot_duration').val()); 
    
    console.log(time_slot_duration);

    time_blocks.forEach(block => {
        total_time_slots += parseInt(Math.floor(block.end.diff(block.start, 'minutes') / time_slot_duration));
    });

    $('#total_time_slots').text('This will create ' + total_time_slots + ' meetings of ' + time_slot_duration + ' minutes each.');
}

function initialize_datetime(datetime_elem){

    const now = moment();

    // if(global_latest_time.hours() <= 22){
    //     global_latest_time = global_latest_time + moment.duration({hours:1});
    // } else {
    //     global_latest_time = global_latest_time + moment.duration({hours:9});
    // }

    $(datetime_elem).find('.date_input').datetimepicker({
        format: 'YYYY-MM-DD',
        defaultDate: global_latest_time,
        minDate: global_latest_time,
        maxDate: moment().add(1, 'years')
    });

    $(datetime_elem).find('.starttime_input').datetimepicker({
        format: 'LT',
        stepping: 15,
        defaultDate: global_latest_time,
        minDate: moment().startOf('day'),
        maxDate: moment().add(1, 'hours')
    }).on('dp.hide', function(e){
        $(datetime_elem).find('.endtime_input').data('DateTimePicker').minDate(e.date.add(15, 'minute'));
        validate_time_fields(false);
    });

    $(datetime_elem).find('.endtime_input').datetimepicker({
        format: 'LT',
        stepping: 15,
        defaultDate: global_latest_time + moment.duration({hours:1}),
        minDate: moment().subtract(1, 'hours'),
        maxDate: moment().endOf('day'),
    }).on('dp.hide', function(e){
        $(datetime_elem).find('.starttime_input').data('DateTimePicker').maxDate(e.date.subtract(15, 'minute'));
        validate_time_fields(false);
    });

    validate_time_fields(false);

}

function update_global_latest_time(new_time){
    
    if(new_time == global_latest_time){
        if(global_latest_time.hours() <= 22){
            global_latest_time = global_latest_time + moment.duration({days:1});
        } else {
            global_latest_time = global_latest_time + moment.hours({hours:9});
        }
    } else {
        if(new_time > global_latest_time){
            global_latest_time = new_time;
        }
    }
    
}

function error_message(message, id){
    
    if(typeof(id) == 'string')
        $('#' + id).addClass('error');
    else
        id.addClass('error');
    
    $('#messageModel').find('.modal-title').html('Error');
    $('#messageModal').find('.modal-body').html(message);
    $('#messageModal').modal('show');

}

function clear_error_message(id){
    $('#' + id).removeClass('error');
}


function validate_time_fields(with_errors){
    valid = true;
    time_slots = [];
    time_blocks = [];
    total_time_slots = 0;

    let datetimes = [];
    
    let latest_time = 0;

    let selected_tab = $('.tab-pane.active').find('label').attr('for');
    let block_value = parseInt($('#' + selected_tab).val());

    $('.datetime__div').each(function(){
        let datetime = {};
        let format = "YYYY-MM-DD hh:mm A";
        let date = $(this).find('.date_input').val() + " ";
        datetime['id'] = $(this).attr('id');
        datetime['start'] = moment(date + $(this).find('.starttime_input').val(), format);
        datetime['end'] = moment(date + $(this).find('.endtime_input').val(), format);
        datetimes.push(datetime);
    });

    datetimes.sort(compare_starttime);

    datetimes.every(function(datetime1, i){
        if(datetime1['start'].isAfter(datetime1['end']) || datetime1['start'].isSame(datetime1['end'])){

            if(with_errors){
                error_message('Start time must be before end time.', $('#' + datetime1['id']).find('input'));
            }
            valid = false;
            return false;
        
        } else {

            let splice_indexes = [];

            let no_overlap = datetimes.slice(i + 1).every(function(datetime2, j){
                if(datetime1['id'] != datetime2['id'] && (
                    datetime1['start'].isAfter(datetime2['start']) && datetime1['start'].isBefore(datetime2['end']) || 
                    datetime1['end'].isAfter(datetime2['start']) && datetime1['end'].isBefore(datetime2['end']) ||
                    datetime1['start'].isSame(datetime2['start']) || datetime1['end'].isSame(datetime2['end']))){
                    
                    if(with_errors){
                        error_message('Datetimes must not overlap.', $('#' + datetime2['id']).find('input'));
                    }
                    valid = false;
                    return false;
                } else {

                    if(datetime1['end'].isSame(datetime2['start'])){
                        datetime1['end'] = datetime2['end'];
                        splice_indexes.push(i + j + 1);
                    }

                    return true;
                }
            });

            if(no_overlap == false){
                return false;
            } else {

                time_blocks.push(datetime1);

                splice_indexes.forEach(function(index){
                    datetimes.splice(index, 1);
                });
                
                if(datetime1['end'].isAfter(latest_time)){
                    latest_time = datetime1['end'];
                }
                return true;
            }
        }
    });

    if(block_value == ''){
        $('#' + selected_tab).addClass('error');
        valid = false;
        return false;
    }

    if(valid){
        update_total_time_slots();
    }

    update_global_latest_time(latest_time);

}

function compare_starttime(a, b){
    if(a['start'].isBefore(b['start'])){
        return -1;
    } else if(a['start'].isAfter(b['start'])){
        return 1;
    } else {
        return 0;
    }
}


function validate_all_fields(){

    $('input').removeClass('error');

    let valid = true;

    let title = $('#title').val();
    

    if(title == ''){
        $('#title').addClass('error');
        valid = false;
        return false;
    }
    
    validate_time_fields(true);

}

function update_time_slots(time_block){
    let duration = time_block['end'] - time_block['start'];
    let slots_per_block = Math.floor(duration.asMinutes() / time_block_size);
    total_time_slots += slots_per_block;
    for(i = 0; i < slots_per_block; i++){
        let time ={
            'start' : time_block['start'].add(i * time_block_size, 'minutes'),
            'end' : time_block['start'].add((i + 1) * time_block_size, 'minutes')
        }
        time_slots.push(time);
    }

    console.log(time_slots);
    
//     $('#' + time_block['id']).find('.total_time').html(total_time.format('HH:mm'));
//     $('#' + time_block['id']).find('.total_blocks').html();
}

async function get_auth_key(){
    await $.ajax({
        url: '/api/auth/key',
        type: 'GET',
        success: function(data){
            auth_key = data.key;
        }
    });
    
    return true;
}

function create_group_category(){
    let category = {};
     
}

function create_groups(){
    let groups = [];

    return groups;
}

function create_calendar_events(groups){

}

function loading(){
    $('.main').children().toggle();
    $('#loading').toggle();
}