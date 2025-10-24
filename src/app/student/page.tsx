
import { StudentPageContent } from './components/student-page-content';
import { getBuses, getStudents, getDestinations, getLostItems, getRoutes } from '@/lib/firebase-data';

// This is the Server Component that fetches initial data
export default async function StudentPage() {
    const [buses, students, destinations, lostItems, routes] = await Promise.all([
        getBuses(),
        getStudents(),
        getDestinations(),
        getLostItems(),
        getRoutes(),
    ]);

    return (
        <StudentPageContent 
            initialBuses={buses}
            initialStudents={students}
            initialDestinations={destinations}
            initialLostItems={lostItems}
            initialRoutes={routes}
        />
    );
}
