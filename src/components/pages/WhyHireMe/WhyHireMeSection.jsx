/* eslint-disable no-unused-vars */
import { Typography } from "@mui/material";
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import AnimatedPagination from "../../ui/animated_pagination";
import WhyCard from "./WhyCardList";
import "./WhyHireMeSection.css";

// Sample skills data
const skills = [
  {
    id: 1,
    title: "UI/UX DESIGN",
    subtitle: "PIXEL-PERFECT INTERFACES",
    category: "hard",
    type: "design",
    description:
      "I create intuitive, elegant user interfaces with meticulous attention to detail and visual harmony.",
    gradientColors: ["#fb923c", "#f97316"],
    link: "#ui-ux-design",
  },
  {
    id: 2,
    title: "REACTJS",
    subtitle: "COMPONENT ARCHITECTURE",
    category: "hard",
    type: "development",
    description:
      "Building scalable, performant web applications with modern React patterns and best practices.",
    gradientColors: ["#fb923c", "#f97316"],
    link: "#react-development",
  },
  {
    id: 3,
    title: "PROBLEM SOLVING",
    subtitle: "ANALYTICAL APPROACH",
    category: "soft",
    type: "skills",
    description:
      "Breaking down complex challenges into manageable solutions with creative and systematic thinking.",
    link: "#problem-solving",
  },
  {
    id: 4,
    title: "COMMUNICATION",
    subtitle: "CLEAR & EFFECTIVE",
    category: "soft",
    type: "skills",
    description:
      "Articulating ideas clearly and listening actively to ensure seamless collaboration and understanding.",
    link: "#communication",
  },
  {
    id: 5,
    title: "FRONTEND",
    subtitle: "RESPONSIVE & INTERACTIVE",
    category: "hard",
    type: "development",
    description:
      "Crafting responsive, accessible interfaces that work flawlessly across all devices and browsers.",
    gradientColors: ["#fb923c", "#f97316"],
    link: "#frontend-development",
  },
  {
    id: 6,
    title: "LEADERSHIP",
    subtitle: "TEAM EMPOWERMENT",
    category: "soft",
    type: "skills",
    description:
      "Motivating teams to achieve excellence through mentorship, vision, and collaborative decision-making.",
    link: "#leadership",
  },
];

export default function WhyHireMeSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState(null);
  const sliderRef = useRef(null);
  const sectionRef = useRef(null);

  // State to track visibility of the section
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Track if user is interacting with the slider
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Enhanced swipe tracking for momentum
  const [swipeData, setSwipeData] = useState({
    startX: 0,
    currentX: 0,
    velocity: 0,
    lastMoveTime: 0,
  });

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Set up the Intersection Observer to detect when the section is in view
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "0px",
      threshold: 0.25,
    };

    const handleIntersection = (entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        setIsVisible(true);
        setIsAnimating(true);
        setTimeout(() => {
          setIsAnimating(false);
        }, (skills.length + 1) * 150);
      }
    };

    const observer = new IntersectionObserver(
      handleIntersection,
      observerOptions
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

  // Custom arrows for the slider - hidden on mobile for touch interaction
  const NextArrow = ({ onClick }) => (
    <motion.button
      className={`carousel-button next ${isMobile ? "hidden" : ""}`}
      onClick={onClick}
      aria-label="Next slide"
      type="button"
      initial={{ opacity: 0, x: 20 }}
      animate={{
        opacity: isVisible && !isMobile ? 1 : 0,
        x: isVisible ? 0 : 20,
      }}
      transition={{
        duration: 0.5,
        delay: 0.6,
        ease: "easeOut",
      }}
      whileHover={{
        scale: 1.1,
        transition: { duration: 0.2 },
      }}
      whileTap={{ scale: 0.95 }}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </motion.button>
  );

  NextArrow.propTypes = {
    onClick: PropTypes.func,
  };

  const PrevArrow = ({ onClick }) => (
    <motion.button
      className={`carousel-button prev ${isMobile ? "hidden" : ""}`}
      onClick={onClick}
      aria-label="Previous slide"
      type="button"
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: isVisible && !isMobile ? 1 : 0,
        x: isVisible ? 0 : -20,
      }}
      transition={{
        duration: 0.5,
        delay: 0.6,
        ease: "easeOut",
      }}
      whileHover={{
        scale: 1.1,
        transition: { duration: 0.2 },
      }}
      whileTap={{ scale: 0.95 }}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </motion.button>
  );

  PrevArrow.propTypes = {
    onClick: PropTypes.func,
  };

  // Enhanced slide direction tracking
  const handleBeforeChange = (current, next) => {
    console.log("Before change:", { current, next }); // Debug log

    if (next > current || (current === skills.length - 1 && next === 0)) {
      setSlideDirection("right");
    } else if (
      next < current ||
      (current === 0 && next === skills.length - 1)
    ) {
      setSlideDirection("left");
    }
  };

  // Function to handle manual slide change from pagination dots
  const handleDotSlideChange = (index) => {
    console.log("Dot slide change to:", index); // Debug log

    if (sliderRef.current) {
      if (index > currentSlide) {
        setSlideDirection("right");
      } else {
        setSlideDirection("left");
      }
      sliderRef.current.slickGoTo(index);
    }
  };

  // Enhanced slide change tracking
  const handleAfterChange = (index) => {
    console.log("After change to slide:", index); // Debug log
    setCurrentSlide(index);
    setIsDragging(false);
  };

  // Enhanced swipe tracking with momentum calculation
  const handleSwipeStart = (direction, { startX }) => {
    setIsDragging(true);
    setSwipeData({
      startX: startX || 0,
      currentX: startX || 0,
      velocity: 0,
      lastMoveTime: Date.now(),
    });
  };

  // Track swipe movement for momentum
  const handleSwipe = (direction, { startX, endX }) => {
    const currentTime = Date.now();
    const deltaTime = currentTime - swipeData.lastMoveTime;
    const deltaX = endX - swipeData.currentX;
    const velocity = deltaTime > 0 ? Math.abs(deltaX / deltaTime) : 0;

    setSwipeData((prev) => ({
      ...prev,
      currentX: endX,
      velocity: velocity,
      lastMoveTime: currentTime,
    }));
  };

  // Enhanced swipe end with momentum
  const handleSwipeEnd = (direction) => {
    const { velocity } = swipeData;

    // Apply momentum based on swipe velocity
    if (velocity > 0.5) {
      // High velocity - allow multiple slides
      const slidesToMove = Math.min(Math.ceil(velocity * 2), 3);

      if (direction === "left") {
        // Swipe left = next slides
        for (let i = 0; i < slidesToMove; i++) {
          setTimeout(() => {
            if (sliderRef.current) {
              sliderRef.current.slickNext();
            }
          }, i * 100);
        }
      } else if (direction === "right") {
        // Swipe right = previous slides
        for (let i = 0; i < slidesToMove; i++) {
          setTimeout(() => {
            if (sliderRef.current) {
              sliderRef.current.slickPrev();
            }
          }, i * 100);
        }
      }
    }

    // Reset swipe data
    setSwipeData({
      startX: 0,
      currentX: 0,
      velocity: 0,
      lastMoveTime: 0,
    });

    setTimeout(() => setIsDragging(false), 200);
  };

  // Enhanced slider settings with momentum support
  const settings = {
    dots: false,
    infinite: true,
    speed: 400,
    slidesToShow: 3,
    slidesToScroll: 1,
    cssEase: "cubic-bezier(0.25, 0.46, 0.45, 0.94)", // Smoother easing
    edgeFriction: 0.15, // Better edge handling
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
    initialSlide: 0,
    swipeToSlide: true,
    draggable: true,
    swipe: true,
    touchMove: true,
    touchThreshold: 3, // More sensitive touch
    lazyLoad: "ondemand",
    focusOnSelect: false,
    centerMode: false,
    variableWidth: false,
    beforeChange: handleBeforeChange,
    afterChange: handleAfterChange,
    onSwipe: handleSwipe,
    onEdge: (direction) => {
      // Add subtle bounce effect at edges
      if (sliderRef.current) {
        const sliderElement = sliderRef.current.innerSlider.list;
        sliderElement.style.transform += ` translateX(${
          direction === "left" ? "-10px" : "10px"
        })`;
        setTimeout(() => {
          sliderElement.style.transform = sliderElement.style.transform.replace(
            / translateX\([^)]+\)/,
            ""
          );
        }, 150);
      }
    },
    responsive: [
      {
        breakpoint: 1280,
        settings: {
          slidesToShow: 2,
          centerPadding: "8%",
          touchThreshold: 4,
          speed: 350,
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
          centerPadding: "12%",
          touchThreshold: 3,
          speed: 300,
        },
      },
      {
        breakpoint: 640, // Mobile breakpoint
        settings: {
          slidesToShow: 2.2,
          slidesToScroll: 1,
          centerPadding: "5%",
          touchThreshold: 2,
          speed: 250,
          swipe: true,
          draggable: true,
          touchMove: true,
          arrows: false,
          infinite: true,
          edgeFriction: 0.1,
          cssEase: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        },
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 1.8,
          slidesToScroll: 1,
          centerPadding: "8%",
          touchThreshold: 2,
          speed: 200,
          swipe: true,
          draggable: true,
          touchMove: true,
          arrows: false,
          infinite: true,
          edgeFriction: 0.05,
        },
      },
      {
        breakpoint: 380,
        settings: {
          slidesToShow: 1.5,
          slidesToScroll: 1,
          centerPadding: "10%",
          touchThreshold: 1,
          speed: 180,
          swipe: true,
          draggable: true,
          touchMove: true,
          arrows: false,
          infinite: true,
          edgeFriction: 0.05,
        },
      },
    ],
  };

  useEffect(() => {
    // Enhanced touch handling with momentum
    const handleTouchStart = (e) => {
      if (isMobile) {
        const touch = e.touches[0];
        handleSwipeStart("start", { startX: touch.clientX });

        // Prevent page scroll while swiping cards
        const slider = document.querySelector(".why-card-slider");
        if (slider && slider.contains(e.target)) {
          e.stopPropagation();
        }
      }
    };

    const handleTouchMove = (e) => {
      if (isMobile && isDragging) {
        const touch = e.touches[0];
        handleSwipe("move", {
          startX: swipeData.startX,
          endX: touch.clientX,
        });
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleTouchEnd = (e) => {
      if (isMobile && isDragging) {
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - swipeData.startX;
        const direction = deltaX > 0 ? "right" : "left";
        handleSwipeEnd(direction);
      }
    };

    // Handle keyboard navigation (desktop only)
    const handleKeyDown = (e) => {
      if (!sliderRef.current || isMobile) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        sliderRef.current.slickPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        sliderRef.current.slickNext();
      }
    };

    // Set up event listeners
    if (!isMobile) {
      window.addEventListener("keydown", handleKeyDown);
    }

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    // Clean up event listeners
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, isMobile, swipeData]);

  // Animation variants for staggered animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.15,
        ease: "easeOut",
      },
    },
  };

  const titleVariants = {
    hidden: {
      y: -50,
      opacity: 0,
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        mass: 1,
        ease: "easeOut",
        duration: 0.8,
      },
    },
  };

  const paginationVariants = {
    hidden: {
      y: 30,
      opacity: 0,
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        delay: 0.5,
        duration: 0.8,
        ease: "easeOut",
      },
    },
  };

  // Mobile swipe instruction component
  const SwipeInstruction = () => (
    <motion.div
      className={`${isMobile ? "block" : "hidden"} text-center mt-4 mb-2`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isVisible ? 0.7 : 0, y: isVisible ? 0 : 10 }}
      transition={{ delay: 1, duration: 0.6 }}
    >
      <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16l-4-4m0 0l4-4m-4 4h18"
          />
        </svg>
        Swipe to explore skills
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 8l4 4m0 0l-4 4m4-4H3"
          />
        </svg>
      </p>
    </motion.div>
  );

  return (
    <section
      ref={sectionRef}
      className={`why-hire-me-section py-16 px-4 relative overflow-hidden ${
        isMobile ? "mobile-optimized" : ""
      }`}
    >
      <motion.div
        className="container mx-auto max-w-8xl"
        initial="hidden"
        animate={isVisible ? "visible" : "hidden"}
        variants={containerVariants}
      >
        <motion.div variants={titleVariants}>
          <Typography
            variant="h2"
            component="h2"
            align="center"
            sx={{
              mb: { xs: 4, md: 8 },
              fontWeight: 900,
              fontFamily: "Inter, sans-serif",
              fontSize: {
                xs: "1.75rem",
                sm: "2.25rem",
                md: "3rem",
              },
              background: "linear-gradient(135deg, #fb923c, #f97316)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              transition: "transform 0.3s ease, background 0.3s ease",
              "&:hover": {
                transform: "scale(1.05)",
                background: "linear-gradient(135deg, #f97316, #fb923c)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              },
            }}
          >
            Why Hire Me?
          </Typography>
        </motion.div>

        {/* Mobile swipe instruction */}
        <SwipeInstruction />

        <div
          className={`carousel-container relative ${
            isMobile ? "mobile-carousel" : ""
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{
              opacity: isVisible ? 1 : 0,
              y: isVisible ? 0 : 60,
            }}
            transition={{
              duration: 0.8,
              delay: 0.3,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <Slider
              ref={sliderRef}
              {...settings}
              className={`why-card-slider ${isMobile ? "mobile-slider" : ""}`}
            >
              {skills.map((skill, index) => (
                <motion.div
                  key={skill.id}
                  className={`slide-item ${
                    isMobile ? "mobile-slide" : "px-4 py-6"
                  }`}
                  style={{
                    padding: isMobile ? "8px" : "16px 24px",
                  }}
                  initial={{
                    opacity: 0,
                    y: isMobile ? 40 : 80,
                    rotateY: isMobile ? 8 : 15,
                    scale: 0.95,
                  }}
                  animate={{
                    opacity: isVisible ? 1 : 0,
                    y: isVisible ? 0 : isMobile ? 40 : 80,
                    rotateY: isVisible ? 0 : isMobile ? 8 : 15,
                    scale: isVisible ? 1 : 0.95,
                  }}
                  transition={{
                    duration: 0.8,
                    delay: 0.2 + index * 0.1,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <WhyCard skill={skill} />
                </motion.div>
              ))}
            </Slider>
          </motion.div>

          {/* Enhanced pagination with fixed current slide tracking */}
          {!isMobile && (
            <motion.div
              className="pagination-container"
              variants={paginationVariants}
            >
              <AnimatedPagination
                dots={Array(skills.length).fill(null)}
                currentSlide={currentSlide}
                slideDirection={slideDirection}
                hideDirectionIndicator={true}
                onSlideChange={handleDotSlideChange}
              />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Decorative background elements - adjusted for mobile */}
      <motion.div
        className={`absolute -bottom-16 -right-16 rounded-full bg-gradient-to-br from-orange-300/10 to-orange-400/5 blur-xl ${
          isMobile ? "w-32 h-32" : "w-64 h-64"
        }`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: isVisible ? 0.8 : 0,
          scale: isVisible ? 1 : 0.8,
          x: isAnimating ? -10 : 0,
          y: isAnimating ? -15 : 0,
        }}
        transition={{
          duration: 1.5,
          ease: "easeOut",
        }}
      />

      <motion.div
        className={`absolute -top-24 -left-24 rounded-full bg-gradient-to-tr from-orange-400/10 to-orange-500/5 blur-xl ${
          isMobile ? "w-48 h-48" : "w-96 h-96"
        }`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: isVisible ? 0.6 : 0,
          scale: isVisible ? 1 : 0.8,
          x: isAnimating ? 15 : 0,
          y: isAnimating ? 10 : 0,
        }}
        transition={{
          duration: 1.5,
          ease: "easeOut",
        }}
      />
    </section>
  );
}
