let studentroles = ['Learner','Demo-learner','Guest'];
let myTime = false;
let userId;
let myRole;
let topPostId;

$(function(){
    
    get_user();
    
});

function get_user(){
    
    $.ajax({
        type: "GET",
        url: '/d2l/api/lp/1.31/users/whoami',
        dataType: 'json',
        success: function (response){
            userId = response.Identifier;            
            get_role();
        }
    
    });
    
}

function get_role(){

    $.ajax({
         
        type: "GET",
        url: '/d2l/api/lp/1.31/enrollments/myenrollments/' + OrgUnitId + '/access',
        dataType: 'json',
        success: function (response){
            
            console.log(response);
            
            RoleName = response.Access.ClasslistRoleName;

            myRole = (studentroles.indexOf(RoleName) != -1) ? 'student' : 'instructor';
            console.log(myRole);
                
            get_available_times('display');
            
        }
    
    });
    
}

function get_available_times(action){
    
    $('#submitSelection').prop('disabled', true);
    
    let selectedTimesByUser = [];
    
    $.ajax({
        type: "GET",
        url: '/d2l/api/le/1.51/' + OrgUnitId + '/discussions/forums/' + ForumId + '/topics/' + TopicId + '/posts/?sort=creationdate&pageSize=1000',
        dataType: 'json',
        success: function (response) {
            console.log(response);
            
            let availableTimes = [];
            
            // put all forum responses into an array
            response.forEach(function(post, i){
                if(i == 0){
                    availableTimes = post.Message.Html.substr(3, post.Message.Html.length - 7).split(';');
                    topPostId = post.PostId;
                } else if(!post.IsDeleted && !post.IsAnonymous) {
                    let selectedTime = post.Message.Html.substr(3, post.Message.Html.length - 7);
                    
                    let posterId = post.PostingUserId;
                    
                    if(typeof(selectedTimesByUser[posterId]) == 'undefined'){
                        selectedTimesByUser[posterId] = [];
                    }
                    
                    selectedTimesByUser[posterId].unshift({'DatePosted' : post.DatePosted, 'SelectedTime' : selectedTime});
                    
                }
            });
            
            
            // loop through each user's responses and each other users' to check for overlap and selection priority by time posted
            let hasConflicts = true;
            
            while(hasConflicts) {
                hasConflicts = false;
                            
                selectedTimesByUser.forEach(function(selections, studentId){
                    
                    if(selections.length > 0){
                    
                        if(!availableTimes.includes(selections[0].SelectedTime)){

                            hasConflicts = true;
                            selections.shift();

                        } else {

                            selectedTimesByUser.forEach(function(otherSelections, otherStudentId){
                                
                                if(otherSelections.length > 0){
                                
                                    if(otherStudentId != studentId){
                                        if(selections[0].SelectedTime == otherSelections[0].SelectedTime){

                                            hasConflicts = true;

                                            if(selections[0].DatePosted > otherSelections[0].DatePosted){
                                                selections.shift();
                                            } else if(otherSelections[0].DatePosted > selections[0].DatePosted) {
                                                otherSelections.shift();
                                            }
                                        }
                                    }
                                    
                                } else {
                                    selectedTimesByUser.splice(otherStudentId,1);
                                }

                            });

                        }
                        
                    } else {
                        selectedTimesByUser.splice(studentId,1);
                    }
                    
                });
            
            }
            
            
            let selectableTimes = availableTimes.slice();
            
            // loop through sanitized time selections and determine what times are left
            selectedTimesByUser.forEach(function(selections){
        
                let indexOfTime = selectableTimes.indexOf(selections[0].SelectedTime);

                selectableTimes.splice(indexOfTime,1);

            });
            
            
            if(action == 'display'){
                show_available_times(availableTimes, selectableTimes, selectedTimesByUser);
                $('#submitSelection').prop('disabled', false);
            } else if(action == 'submit'){
                submit_selection(selectableTimes);
            }
        }
    });
    
}

function show_available_times(availableTimes, selectableTimes, selectedTimesByUser){
        
    let output = [];
    
    selectedTimesByUser.forEach(function(selections, studentId){
        output.push(selections[0].SelectedTime + ' : ' + studentId);
    });
    
    if(myRole == 'student'){
        if(typeof(selectedTimesByUser[userId]) != 'undefined'){
            myTime = selectedTimesByUser[userId][0].SelectedTime;
        }
        
        $('#main').html((myTime !== false ? '<h2>You have selected ' + myTime + '</h2>' : '<h2>Please select a time</h2>') + (selectableTimes.length > 0 ? 'Currently available times to select: <select id="timeSelection"><option>' + selectableTimes.join('</option><option>') + '</option></select> <input type="button" id="submitSelection" onclick="get_available_times(\'submit\')" value="Select this time" /></p>' : ''));
    } else {
        $('#main').html('<p>Available times: ' + availableTimes.join(', ') + '</p><p>Student selections:</p><ul><li>' + output.join(' <input type="button" value="Cancel" /></li><li>') + ' <input type="button" value="Cancel" /></li></ul>');
    }
    
}

function edit_available_times(times){
    
}

function submit_selection(selectableTimes){
    
    let selectedTime = $('#timeSelection').val();
    
    if(selectableTimes.includes(selectedTime)){
        // submit time selection
        let newPost = {
            "ParentPostId": topPostId,
            "Subject": "Available Times",
            "Message": {
                "Content": "<p>" + selectedTime + "</p>",
                "Type": "Html"
            },
            "IsAnonymous": false
        };
        
        newPost = JSON.stringify(newPost);
        
        $.ajax({
            method: "GET",
            url: "/d2l/lp/auth/xsrf-tokens",
            success: function (token) {
               
                $.ajax({
                    type: "POST",
                    url: '/d2l/api/le/1.51/' + OrgUnitId + '/discussions/forums/' + ForumId + '/topics/' + TopicId + '/posts/',
                    data: newPost,
                    dataType: 'json',
                    beforeSend: function (request) {
                        request.setRequestHeader("Content-Type", "application/json")
                        request.setRequestHeader("X-Csrf-Token", token.referrerToken);
                    },
                    success: function () {
                        window.location.reload();
                    },
                    error: function (response){
                        console.log(response);
                    }
                });
                
            }
        });
    }
    
}

function cancel_selection(user){
    
}
