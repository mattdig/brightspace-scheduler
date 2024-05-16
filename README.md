# brightspace-scheduler

# Installation:

Before uploading the files to Brightspace, find the resources/js/example-config.js file. Rename this file to config.js. The values for adminLinkId and signupLinkId will need to be filled in later, and this file will need to be uploaded on its own.

Upload all files to the Brightspace "Public Files" area. For this example we're using "Plugins/Scheduler" as the location. This is path will be needed later.

# Create 2 Custom Links:

First Link:
- Name: Scheduler (This title will be shown in a Navbar for instructors to create new schedules)
- URL: https://{YOUR_BRIGHTSPACE_DOMAIN}/shared/Plugins/Scheduler/setup.html
- Behaviour: Same window
- Availability:
	- Share with child org units
	- Limit to specific roles
		- Select all roles that should create schedules (not students)
- Save

Get the new link's ID:
- Click on the link you just created to edit it
- Look at the URL for "customlink/edit/{ID_NUMBER}"
- This ID must be set as the value for adminLinkId in config.js

Second Link:
- Name: Scheduler Signup (only used by the scheduler, never shown in a navbar)
- URL: https://{YOUR_BRIGHTSPACE_DOMAIN}/shared/Plugins/Scheduler/signup.html
- Behaviour: Same window
- Availability: Share with child org units
- Save

Get the new link's ID:
- Click on the link you just created to edit it
- Look at the URL for "customlink/edit/{ID_NUMBER}"
- This ID must be set as the value for signupLinkId in config.js

Save the config.js file with the new link IDs. Add the numeric IDs for any Student, Teaching Assistant, and Instructor roles to the config.js file. Upload config.js to Plugins/Scheduler/resources/js/

Add the first link, "Scheduler" to a navbar in a course (or all courses).

Access the course as an instructor to create a new schedule for the students.

# Display Email Addresses
Change `d2l.Tools.Classlist.DisplayEmail` to on for the top level organization.

# TODO
- Email enrollment updates to instructor(s)
- Add recurring events (eg. every Monday & Wednesday at 1 - 3 pm)
- merge GROUPS and existingTimeSlots global vars in js/signup.js
