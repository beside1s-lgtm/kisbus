
import { getBuses, getStudents, getDestinations } from '@/lib/firebase-data';
import { StudentPageContent } from './components/student-page-content';

// This is the Server Component that fetches initial data
export default async function StudentPage() {
    const [buses, students, destinations] = await Promise.all([
        getBuses(),
        getStudents(),
        getDestinations(),
    ]);

    return (
        <StudentPageContent 
            initialBuses={buses}
            initialStudents={students}
            initialDestinations={destinations}
        />
    );
}
