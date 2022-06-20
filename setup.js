let latest_time = moment();
let time_blocks = [];

$(function() {
    let start = moment().startOf('hour');
    let end = moment().startOf('hour').add(3, 'hour');
    $('#daterange_1_content').html(start.format('YYYY MM DD') + ' - ' + end.format('YYYY MM DD') + ', ' + start.format('h:mm A') + ' - ' + end.format('h:mm A'));
    initialize_daterange('daterange_1');
});

function add_daterange(){
    let last_daterange = $('.daterange__div').last();
    let new_daterange = last_daterange.clone();
    let new_length = $('.daterange__div').length + 1

    new_daterange.find('h3').text('Date Range ' + new_length);
    new_daterange.find('.daterange__p').attr('id', 'daterange_' + new_length);
    new_daterange.find('.daterange__span').attr('id', 'daterange_' + new_length + '_content');
    
    new_daterange.insertAfter(last_daterange);
    initialize_daterange('daterange_' + new_length);   // initialize the new daterange
}

function select_tab(obj){
    $('.tabs').find('li').removeClass('active');
    $(obj).parent().addClass('active');
    $('.tabs').find('div').removeClass('active');
    $('.tabs').find($(obj).attr('href')).addClass('active');
}

function update_total_time(){
    let total_time = 0;
    $('.daterange__span').each(function(){
        let time = $(this).text();
        if(time != ''){
            total_time += parseInt(time);
        }
    });
    $('#total_time').text('Total time: ' + total_time + ' minutes');
    
    update_total_time_blocks();
}

function update_total_time_blocks(){
    let total_time_blocks = 0;
    $('.daterange__span').each(function(){
        let time = $(this).text();
        if(time != ''){
            total_time_blocks += Math.ceil(parseInt(time) / parseInt($('#time_block_size').val()));
        }
    });
    $('#total_time_blocks').text('This will create ' + total_time_blocks + ' blocks of ' + $('#time_block_size').val() + ' minutes each.');
}

function initialize_daterange(id){

    let previous_daterange = $('#' + id).pare;

    let newStart = moment();

    $('#'+id).daterangepicker({
            timePicker: true,
            singleDatePicker: true,
            startDate: newStart.startOf('hour'),
            endDate: newStart.startOf('hour').add(3, 'hour'),
            timePickerIncrement: 5,
        }, function(start, end){
            
            let new_date = start.format('YYYY MM DD') + ' - ' + end.format('YYYY MM DD') + ', ' + start.format('h:mm A') + ' - ' + end.format('h:mm A');
            $('#' + id + '_content').html(new_date);
            
            let no_overlap = true;            
            time_blocks.some(function(time_block){
                // if the new daterange overlaps with an existing time block, remove it
                if(start.isBetween(time_block.start, time_block.end) || end.isBetween(time_block.start, time_block.end)){
                    no_overlap = false;
                    error_message('The date range you selected overlaps with an existing time block.', time_block.id);
                    return false;
                }
            });

            if(no_overlap){
                clear_error_message(id);

                time_blocks.push({
                    id: id,
                    start: start,
                    end: end
                });

                if(end > latest_time){
                    latest_time = end;
                }
    
                update_total_time();
            } else {
                $('#' + id + '_content').html("");
            }

        });
}

function error_message(message, id){
    $('#' + id).addClass('error');
    $('#messageModel').find('.modal-title').html('Error');
    $('#messageModal').find('.modal-body').html(message);
    $('#messageModal').modal('show');
}

function clear_error_message(id){
    $('#' + id).removeClass('error');
}


function validate(){
    let title = $('#title').val();
    let dateranges = [];

    $('.daterange__div').each(function(){
        let daterange = {};
        daterange['start'] = $(this).find('input').data('daterangepicker').startDate.format('YYYY-MM-DD HH:mm:ss');
        daterange['end'] = $(this).find('input').data('daterangepicker').endDate.format('YYYY-MM-DD HH:mm:ss');
        dateranges.push(daterange);
    });

    $('#time_blocks').val(parseInt($('#time_blocks').val()));
    $('#time_block_size').val(parseInt($('#time_block_size').val()));

    let valid = true;

    if(title == ''){
        $('#title').addClass('error');
        valid = false;
    }
    if(time_blocks == ''){
        $('#time_blocks').addClass('error');
        valid = false;
    }
    $('.daterange__input').each(function(){
        if($(this).val() == ''){
            $(this).addClass('error');
            valid = false;
        }
    });
}