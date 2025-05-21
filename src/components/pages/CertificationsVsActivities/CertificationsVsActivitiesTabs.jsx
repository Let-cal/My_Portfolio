import { AnimatePresence, motion } from "framer-motion";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import AnimatedPagination from "../../ui/animated_pagination";
import DynamicTypography from "../../ui/dynamic_typography";
import ActivityCard from "./ActivityCard";
import CertificationCard from "./CertificationCard";
import CertificationsBackground from "./CertificationsBackground";
import "./CertificationsVsActivitiesStyles.css";

export default function CertificationsVsActivitiesTabs({
  certifications,
  activities,
  showPageCounter = false, // New prop to control page counter display
}) {
  const [activeTab, setActiveTab] = useState("certifications");
  const tabsRef = useRef(null);
  const indicatorRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);
  const containerRef = useRef(null); // Ref for swipeable container

  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [slideDirection, setSlideDirection] = useState(null);
  const itemsPerPage = 6;

  // Calculate total pages based on active tab
  const activeItems =
    activeTab === "certifications" ? certifications : activities;
  const totalPages = Math.ceil(activeItems.length / itemsPerPage);

  // Reset pagination when tab changes
  useEffect(() => {
    setCurrentPage(0);
    setSlideDirection(null);
  }, [activeTab]);

  useEffect(() => {
    // Animate the indicator when tab changes
    if (indicatorRef.current && tabsRef.current) {
      const activeTabElement = tabsRef.current.querySelector(
        `#${activeTab}-tab`
      );
      if (activeTabElement) {
        const tabRect = activeTabElement.getBoundingClientRect();
        const containerRect = tabsRef.current.getBoundingClientRect();

        indicatorRef.current.style.width = `${tabRect.width}px`;
        indicatorRef.current.style.transform = `translateX(${
          tabRect.left - containerRect.left
        }px)`;
      }
    }
  }, [activeTab]);

  // Intersection Observer to detect when section comes into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.1,
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Handle page change
  const handlePageChange = (pageIndex) => {
    if (pageIndex >= 0 && pageIndex < totalPages) {
      setSlideDirection(pageIndex > currentPage ? "right" : "left");
      setCurrentPage(pageIndex);
    }
  };

  // Handle swipe end for page navigation
  const handleDragEnd = (event, info) => {
    const threshold = 100; // Minimum swipe distance to trigger page change
    if (info.offset.x < -threshold && currentPage < totalPages - 1) {
      handlePageChange(currentPage + 1);
    } else if (info.offset.x > threshold && currentPage > 0) {
      handlePageChange(currentPage - 1);
    }
  };

  // Get current items to display
  const getCurrentItems = () => {
    const startIndex = currentPage * itemsPerPage;
    return activeItems.slice(startIndex, startIndex + itemsPerPage);
  };

  // Create dots for pagination
  const paginationDots = Array.from({ length: totalPages }, (_, i) => (
    <span key={i} />
  ));

  // Card variants for animation
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
      },
    },
  };

  // Animation variants for page transition
  const pageTransitionVariants = {
    enter: (direction) => ({
      x: direction === "left" ? -100 : 100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 },
      },
    },
    exit: (direction) => ({
      x: direction === "left" ? 100 : -100,
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 },
      },
    }),
  };

  return (
    <section ref={sectionRef} className="relative w-full min-h-screen pb-24">
      <CertificationsBackground />
      <div className="relative z-10 container mx-auto px-4 py-16">
        <DynamicTypography />
        {/* Tab controls */}
        <motion.div
          className="flex justify-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div
            ref={tabsRef}
            className="control relative bg-opacity-10 bg-orange-100 backdrop-blur-md border border-orange-200/20 rounded-full p-1 shadow-lg pr-4"
          >
            <div className="control__track relative flex items-center">
              <div
                ref={indicatorRef}
                className="indicator absolute h-full bg-orange-500/30 backdrop-blur-md rounded-full transition-transform"
                style={{ width: "50%" }}
              ></div>

              <label
                id="certifications-tab"
                onClick={() => handleTabChange("certifications")}
                className={`relative z-10 cursor-pointer py-2 px-6 text-sm font-medium transition-colors duration-300 ${
                  activeTab === "certifications"
                    ? "text-white"
                    : "text-white/60"
                }`}
              >
                Certifications
              </label>

              <label
                id="activities-tab"
                onClick={() => handleTabChange("activities")}
                className={`relative z-10 cursor-pointer py-2 px-6 text-sm font-medium transition-colors duration-300 ${
                  activeTab === "activities" ? "text-white" : "text-white/60"
                }`}
              >
                Activities
              </label>
            </div>
          </div>
        </motion.div>

        {/* Content with AnimatePresence for tab transitions */}
        <div className="w-full relative min-h-[600px]">
          <AnimatePresence mode="wait">
            {activeTab === "certifications" ? (
              <motion.div
                key={`page-certifications-${currentPage}`}
                custom={slideDirection}
                variants={pageTransitionVariants}
                initial="enter"
                animate="center"
                exit="exit"
                drag="x" // Enable horizontal drag
                dragConstraints={{ left: 0, right: 0 }} // Constrain drag to horizontal
                dragElastic={0.2} // Smooth drag feel
                onDragEnd={handleDragEnd} // Handle swipe to change page
                ref={containerRef}
              >
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate={isVisible ? "visible" : "hidden"}
                >
                  {getCurrentItems().map((cert) => (
                    <motion.div key={cert.id} variants={cardVariants}>
                      <CertificationCard {...cert} />
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key={`page-activities-${currentPage}`}
                custom={slideDirection}
                variants={pageTransitionVariants}
                initial="enter"
                animate="center"
                exit="exit"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                ref={containerRef}
              >
                <motion.div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate={isVisible ? "visible" : "hidden"}
                >
                  {getCurrentItems().map((activity) => (
                    <motion.div key={activity.id} variants={cardVariants}>
                      <ActivityCard {...activity} />
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {showPageCounter && (
          <div className="flex justify-center mt-8">
            <motion.div
              className="text-center text-sm text-white/80 bg-white/10 px-4 py-2 rounded-full border border-white/20"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              Page {currentPage + 1} of {totalPages}
            </motion.div>
          </div>
        )}
        {/* Pagination with Page Counter */}
        {totalPages > 1 && (
          <div className="mt-16 relative flex flex-col items-center">
            <AnimatedPagination
              dots={paginationDots}
              currentSlide={currentPage}
              slideDirection={slideDirection}
              hideDirectionIndicator={true}
              onSlideChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </section>
  );
}

CertificationsVsActivitiesTabs.propTypes = {
  certifications: PropTypes.arrayOf(PropTypes.object).isRequired,
  activities: PropTypes.arrayOf(PropTypes.object).isRequired,
  showPageCounter: PropTypes.bool, // Prop to toggle page counter
};
