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

  // Set up the Intersection Observer to detect when the section is in view
  useEffect(() => {
    const observerOptions = {
      root: null, // use the viewport as the reference
      rootMargin: "0px", // no margin
      threshold: 0.25, // trigger when at least 25% of the element is visible
    };

    const handleIntersection = (entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        setIsVisible(true);
        setIsAnimating(true);
        // After all cards have animated in, set isAnimating to false
        setTimeout(() => {
          setIsAnimating(false);
        }, (skills.length + 1) * 150); // Delay based on number of cards plus title animation
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

  // Custom arrows for the slider with updated styling
  const NextArrow = ({ onClick }) => (
    <motion.button
      className="carousel-button next"
      onClick={onClick}
      aria-label="Next slide"
      type="button"
      initial={{ opacity: 0, x: 20 }}
      animate={{
        opacity: isVisible ? 1 : 0,
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
      className="carousel-button prev"
      onClick={onClick}
      aria-label="Previous slide"
      type="button"
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: isVisible ? 1 : 0,
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

  // Determine slide direction when changing slides
  const handleBeforeChange = (current, next) => {
    // Logic to determine slide direction (right or left)
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
    if (sliderRef.current) {
      // Determine direction for animation
      if (index > currentSlide) {
        setSlideDirection("right");
      } else {
        setSlideDirection("left");
      }
      sliderRef.current.slickGoTo(index);
    }
  };

  // Track slide change
  const handleAfterChange = (index) => {
    setCurrentSlide(index);
    setIsDragging(false);
  };

  // Track drag state
  const handleSwipeStart = () => {
    setIsDragging(true);
  };

  // Enhanced slider settings with better swipe mechanics
  const settings = {
    dots: false, // We'll use our custom AnimatedPagination
    infinite: true, // Enables endless scrolling
    speed: 300,
    slidesToShow: 3,
    slidesToScroll: 1,
    cssEase: "ease-out",
    edgeFriction: 0.15,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
    initialSlide: 0,
    swipeToSlide: true,
    draggable: true,
    swipe: true,
    touchMove: true,
    touchThreshold: 8, // More sensitive touch response
    beforeChange: handleBeforeChange,
    afterChange: handleAfterChange,
    swipeEvent: handleSwipeStart,
    responsive: [
      {
        breakpoint: 1280,
        settings: {
          slidesToShow: 2,
          centerPadding: "8%",
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
          centerPadding: "15%",
        },
      },
    ],
  };

  useEffect(() => {
    // Handle keyboard navigation
    const handleKeyDown = (e) => {
      if (!sliderRef.current) return;

      if (e.key === "ArrowLeft") {
        sliderRef.current.slickPrev();
      } else if (e.key === "ArrowRight") {
        sliderRef.current.slickNext();
      }
    };

    // Prevent horizontal scroll of the page when the carousel is swiped
    const preventPageScroll = (e) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Set up event listeners
    window.addEventListener("keydown", handleKeyDown);
    document
      .querySelector(".why-card-slider")
      ?.addEventListener("touchmove", preventPageScroll, { passive: false });

    // Clean up event listeners
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document
        .querySelector(".why-card-slider")
        ?.removeEventListener("touchmove", preventPageScroll);
    };
  }, [isDragging]);

  // Manual navigation methods
  const goToNext = () => {
    if (sliderRef.current) {
      sliderRef.current.slickNext();
    }
  };

  const goToPrev = () => {
    if (sliderRef.current) {
      sliderRef.current.slickPrev();
    }
  };

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

  return (
    <section
      ref={sectionRef}
      className="why-hire-me-section py-16 px-4 relative overflow-hidden"
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
              mb: { xs: 6, md: 10 },
              fontWeight: 900,
              fontFamily: "Inter, sans-serif",
              fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
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

        <div className="carousel-container relative">
          {/* Custom wrapper for the slider to handle animation */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{
              opacity: isVisible ? 1 : 0,
              y: isVisible ? 0 : 60,
            }}
            transition={{
              duration: 0.8,
              delay: 0.3,
              ease: [0.16, 1, 0.3, 1], // Custom bezier curve for smooth animation
            }}
          >
            <Slider ref={sliderRef} {...settings} className="why-card-slider">
              {skills.map((skill, index) => (
                <motion.div
                  key={skill.id}
                  className="px-4 py-6 slide-item"
                  initial={{
                    opacity: 0,
                    y: 80,
                    rotateY: 15,
                    scale: 0.95,
                  }}
                  animate={{
                    opacity: isVisible ? 1 : 0,
                    y: isVisible ? 0 : 80,
                    rotateY: isVisible ? 0 : 15,
                    scale: isVisible ? 1 : 0.95,
                  }}
                  transition={{
                    duration: 0.8,
                    delay: 0.2 + index * 0.15, // Staggered delay based on index
                    ease: [0.16, 1, 0.3, 1], // Custom bezier curve
                  }}
                >
                  <WhyCard skill={skill} />
                </motion.div>
              ))}
            </Slider>
          </motion.div>

          {/* Custom pagination with animation */}
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
        </div>
      </motion.div>

      {/* Decorative background elements with parallax effect */}
      <motion.div
        className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-gradient-to-br from-orange-300/10 to-orange-400/5 blur-xl"
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
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-gradient-to-tr from-orange-400/10 to-orange-500/5 blur-xl"
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
