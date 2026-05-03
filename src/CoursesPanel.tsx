import CourseSearch from "./features/search/CourseSearch";
import CourseSelector from "./features/selection/CourseSelector";
import { useStore } from "./store";

interface Props {
  open: boolean;
}

/**
 * The expandable "Courses" panel — search input on the left, selected
 * course grid on the right. Hidden until the user toggles it open via
 * AppHeader.
 */
export default function CoursesPanel({ open }: Props) {
  const credentials = useStore((s) => s.credentials);
  const courseGroups = useStore((s) => s.courseGroups);
  const selectedCourses = useStore((s) => s.selectedCourses);
  const toggleCourse = useStore((s) => s.toggleCourse);
  const removeCourse = useStore((s) => s.removeCourse);

  if (!open || !credentials) return null;

  return (
    <div className="sticky top-12 z-10 border-b border-gray-800/80 bg-gray-900/95 backdrop-blur-sm">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-3">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
          <div className="sm:w-72 sm:shrink-0">
            <CourseSearch />
          </div>

          {courseGroups.size > 0 && (
            <div className="flex-1 min-w-0 sm:border-l border-gray-800/60 sm:pl-6">
              <CourseSelector
                courseGroups={courseGroups}
                selectedCourses={selectedCourses}
                onToggle={toggleCourse}
                onRemove={removeCourse}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
