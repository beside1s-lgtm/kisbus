# **App Name**: KIS School Bus Manager

## Core Features:

- Admin Dashboard: Create and manage school bus lists (45, 25, 15-seater), assign bus numbers, and register students.  Batch registration via CSV upload. The admin will be able to add destination to each student.
- Seating Management: Randomly assign students to seats on a bus seat map. Drag-and-drop interface for moving students between seats or removing them from the bus. Separate configurations for school arrival and departure.  Differentiate students by day of the week.
- Teacher Dashboard: Teachers can mark student absences, view seat assignments, swap student seating assignments. Also, a tool to designate group leaders (조장) and calculate 봉사 (volunteer) time.
- Group Leader Time Tracker: Automatically calculate and display 봉사 time (20 minutes/day) for designated group leaders. This is resetable. Teachers mark the student in the UI as group leader, triggering the tool to track 봉사 time.
- Student Dashboard: Students can view a graphical seat map, tap their name/seat to indicate boarding (color change), and tap again to indicate disembarking (revert color). Different colors for absent vs. present.
- Absence Tracking: Teachers register student absence, which will flag those students on the seat map.  This system will allow easy lookup for absent students, and differentiate those who will not be attending school for the day from those who simply haven't disembarked.
- Destination management: Admins add the destination in the students' data. Admin also organize and assign each route destinations according to its turn.

## Style Guidelines:

- Primary color: Sky blue (#87CEEB), reflecting a sense of safety and reliability.
- Background color: Very light blue (#F0F8FF), provides a calm backdrop.
- Accent color: Soft yellow (#FAFAD2) for highlighting key interactive elements and CTAs.
- Font: 'PT Sans' (sans-serif) for body text and headlines to ensure readability and a modern feel.
- Use simple, recognizable icons to represent bus types, student roles, and actions like boarding/disembarking.
- Employ a clear, grid-based layout across all dashboards for intuitive navigation and data presentation.
- Use subtle transitions and animations to provide feedback on user interactions, like seat selection or absence marking.