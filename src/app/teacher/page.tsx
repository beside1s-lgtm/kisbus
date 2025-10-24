
import { TeacherPageContent } from './components/teacher-page-content';
import { getBuses, getStudents, getDestinations, getTeachers, getLostItems, getRoutes } from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, Teacher, LostItem } from '@/lib/types';

// This is the Server Component that fetches initial data
export default async function TeacherPage() {
    const [busesData, studentsData, destinationsData, teachersData, lostItemsData, routesData] = await Promise.all([
        getBuses(),
        getStudents(),
        getDestinations(),
        getTeachers(),
        getLostItems(),
        getRoutes(),
    ]);

    return (
        <TeacherPageContent 
            initialBuses={busesData}
            initialStudents={studentsData}
            initialDestinations={destinationsData}
            initialTeachers={teachersData}
            initialLostItems={lostItemsData}
            initialRoutes={routesData}
        />
    );
}
