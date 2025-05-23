import {
  Badge,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Text,
  useBreakpointValue,
  useDisclosure,
  useMediaQuery,
  useToken,
} from "@chakra-ui/react";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew"; // Icon cho prev
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos"; // Icon cho next
import { motion, useAnimation, useInView } from "framer-motion";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import WorkDetailModal from "../ExperienceSection/WorkDetailModal";
import SkillDetailModal from "./SkillDetailModal";

// Lazy load components
const SkillCard = lazy(() => import("./SkillCard"));
const AnimatedPagination = lazy(() => import("../../ui/animated_pagination"));
const WebSkillsModal = lazy(() => import("./ShowSkillsDetail/WebSkillsModal"));
const MobileSkillsView = lazy(() =>
  import("./ShowSkillsDetail/MobileSkillsView")
);

// Background images
import backgroundImage from "/images/background.png";
import illustrationImage from "/images/Illustration.png";

const CoreSkillsSection = () => {
  // Skills data - this would typically come from a data file or API
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const skills = [
    {
      id: "reactjs",
      name: "ReactJS",
      icon: "/icons/react.svg",
      level: 70,
      description:
        "Component-based UI library for building interactive interfaces",
      experience: "3+ years of professional experience",
      projects: [
        {
          title: "SitePlus Commercial Consulting System",
          summary:
            "Cooperated with SitePlus to create an internal site/space consulting system for company employees, to help brands find ideal spaces according to their business needs using AI.",
          description:
            "• Analysis & Planning: Requirements gathering, risk/gap assessments, evaluation criteria setup.\n• System & Data Design: Modular back‐end, ERD models, real‐time dashboards, privacy controls.\n• UX/UI Leadership: Wireframes & high‐fi Figma mocks for approval workflows and POS integrations.\n• Collaboration: Feedback loops with stakeholders to keep delivery on schedule.\n• Features: Automated survey tasks, contract & revenue modules, SignalR notifications.\n• Outcomes: 30% error reduction, 25% throughput increase, 95% stakeholder satisfaction.",
          techStack: [
            "React.js & TypeScript",
            "Dart & Flutter",
            "SQL Server",
            "Tailwind CSS",
            "Figma",
          ],
          demoLink: "https://demo.siteplus.example.com",
          codeLink: "https://github.com/yourrepo/siteplus",
          timeline: "Jan 2025 – Apr 2025",
        },
        {
          title: "ZodiacGems E-commerce Platform",
          summary:
            "Personalized jewelry recommendations via zodiac compatibility & Feng Shui rules.",
          description:
            "• Architecture & Leadership: System design, team mentoring, agile ceremonies.\n• Recommendation Engine: Rule-based mapping of zodiac & elemental affinities.\n• UI/UX: Smart filters, zodiac-themed visuals, seamless checkout flows in Figma.\n• API & Data Modeling: MongoDB catalogs, GraphQL endpoints for client‐driven queries.\n• Outcomes: +25% conversion, +30% AOV, +18% retention.",
          techStack: [
            "React.js",
            "JavaScript",
            "Dart & Flutter",
            "SQL Server",
            "Tailwind CSS",
            "Figma",
          ],
          demoLink: "https://zodiacgems.example.com",
          codeLink: "https://github.com/yourrepo/zodiacgems",
          timeline: "Jun 2024 – Oct 2024",
        },
      ],
    },
    {
      id: "nextjs",
      name: "Next.js",
      icon: "/icons/nextjs.png",
      level: 60,
      description: "React framework for production with server-side rendering",
      experience: "2+ years building production applications",
      projects: [],
    },
    {
      id: "javascript",
      name: "JavaScript",
      icon: "/icons/javascript.svg",
      level: 70,
      description: "Core programming language for web development",
      experience: "2+ years of expertise in ES6+ features",
      projects: [
        {
          title: "Meet My Lecturer",
          summary:
            "Web-based scheduler syncing with Google Calendar & Meet, real-time notifications.",
          description:
            "• Engine & Real-time: Socket.io infrastructure, two-way Google Calendar integration.\n• UX/UI: Figma booking flows optimized for desktop & mobile.\n• Dashboards: MongoDB aggregations for session metrics, analytics UI.\n• Outcomes: +40% utilization, −70% admin overhead, 4.8/5 satisfaction.",
          techStack: [
            "Java Servlet",
            "SQL Server",
            "Google Calendar API",
            "Socket.io",
            "Figma",
          ],
          demoLink: "https://meetmylecturer.example.com",
          codeLink: "https://github.com/yourrepo/meet-my-lecturer",
          timeline: "Jul 2023 – Nov 2023",
        },
      ],
    },
    {
      id: "typescript",
      name: "TypeScript",
      icon: "/icons/typescript.svg",
      level: 60,
      description: "JavaScript with syntax for types",
      experience: "1+ years implementing in enterprise projects",
      projects: [
        {
          title: "SitePlus Commercial Consulting System",
          summary:
            "Cooperated with SitePlus to create an internal site/space consulting system for company employees, to help brands find ideal spaces according to their business needs using AI.",
          description:
            "• Analysis & Planning: Requirements gathering, risk/gap assessments, evaluation criteria setup.\n• System & Data Design: Modular back‐end, ERD models, real‐time dashboards, privacy controls.\n• UX/UI Leadership: Wireframes & high‐fi Figma mocks for approval workflows and POS integrations.\n• Collaboration: Feedback loops with stakeholders to keep delivery on schedule.\n• Features: Automated survey tasks, contract & revenue modules, SignalR notifications.\n• Outcomes: 30% error reduction, 25% throughput increase, 95% stakeholder satisfaction.",
          techStack: [
            "React.js & TypeScript",
            "Dart & Flutter",
            "SQL Server",
            "Tailwind CSS",
            "Figma",
          ],
          demoLink: "https://demo.siteplus.example.com",
          codeLink: "https://github.com/yourrepo/siteplus",
          timeline: "Jan 2025 – Apr 2025",
        },
      ],
    },
    {
      id: "flutter",
      name: "Dart & Flutter",
      icon: "/icons/flutter.svg",
      level: 70,
      description: "UI toolkit for building natively compiled applications",
      experience: "2+ years of mobile app development",
      projects: [
        {
          title: "SitePlus Commercial Consulting System",
          summary:
            "Cooperated with SitePlus to create an internal site/space consulting system for company employees, to help brands find ideal spaces according to their business needs using AI.",
          description:
            "• Analysis & Planning: Requirements gathering, risk/gap assessments, evaluation criteria setup.\n• System & Data Design: Modular back‐end, ERD models, real‐time dashboards, privacy controls.\n• UX/UI Leadership: Wireframes & high‐fi Figma mocks for approval workflows and POS integrations.\n• Collaboration: Feedback loops with stakeholders to keep delivery on schedule.\n• Features: Automated survey tasks, contract & revenue modules, SignalR notifications.\n• Outcomes: 30% error reduction, 25% throughput increase, 95% stakeholder satisfaction.",
          techStack: [
            "React.js & TypeScript",
            "Dart & Flutter",
            "SQL Server",
            "Tailwind CSS",
            "Figma",
          ],
          demoLink: "https://demo.siteplus.example.com",
          codeLink: "https://github.com/yourrepo/siteplus",
          timeline: "Jan 2025 – Apr 2025",
        },
        {
          title: "ZodiacGems E-commerce Platform",
          summary:
            "Personalized jewelry recommendations via zodiac compatibility & Feng Shui rules.",
          description:
            "• Architecture & Leadership: System design, team mentoring, agile ceremonies.\n• Recommendation Engine: Rule-based mapping of zodiac & elemental affinities.\n• UI/UX: Smart filters, zodiac-themed visuals, seamless checkout flows in Figma.\n• API & Data Modeling: MongoDB catalogs, GraphQL endpoints for client‐driven queries.\n• Outcomes: +25% conversion, +30% AOV, +18% retention.",
          techStack: [
            "React.js",
            "JavaScript",
            "Dart & Flutter",
            "SQL Server",
            "Tailwind CSS",
            "Figma",
          ],
          demoLink: "https://zodiacgems.example.com",
          codeLink: "https://github.com/yourrepo/zodiacgems",
          timeline: "Jun 2024 – Oct 2024",
        },
      ],
    },
    {
      id: "gsap",
      name: "GSAP",
      icon: "/icons/gsap.svg",
      level: 60,
      description: "Professional-grade animation library for the modern web",
      experience: "1+ years creating smooth animations",
      projects: [],
    },
    {
      id: "tailwindcss",
      name: "TailwindCSS",
      icon: "/icons/tailwind.svg",
      level: 70,
      description: "Utility-first CSS framework for rapid UI development",
      experience: "2+ years building responsive interfaces",
      projects: [
        {
          title: "SitePlus Commercial Consulting System",
          summary:
            "Cooperated with SitePlus to create an internal site/space consulting system for company employees, to help brands find ideal spaces according to their business needs using AI.",
          description:
            "• Analysis & Planning: Requirements gathering, risk/gap assessments, evaluation criteria setup.\n• System & Data Design: Modular back‐end, ERD models, real‐time dashboards, privacy controls.\n• UX/UI Leadership: Wireframes & high‐fi Figma mocks for approval workflows and POS integrations.\n• Collaboration: Feedback loops with stakeholders to keep delivery on schedule.\n• Features: Automated survey tasks, contract & revenue modules, SignalR notifications.\n• Outcomes: 30% error reduction, 25% throughput increase, 95% stakeholder satisfaction.",
          techStack: [
            "React.js & TypeScript",
            "Dart & Flutter",
            "SQL Server",
            "Tailwind CSS",
            "Figma",
          ],
          demoLink: "https://demo.siteplus.example.com",
          codeLink: "https://github.com/yourrepo/siteplus",
          timeline: "Jan 2025 – Apr 2025",
        },
        {
          title: "ZodiacGems E-commerce Platform",
          summary:
            "Personalized jewelry recommendations via zodiac compatibility & Feng Shui rules.",
          description:
            "• Architecture & Leadership: System design, team mentoring, agile ceremonies.\n• Recommendation Engine: Rule-based mapping of zodiac & elemental affinities.\n• UI/UX: Smart filters, zodiac-themed visuals, seamless checkout flows in Figma.\n• API & Data Modeling: MongoDB catalogs, GraphQL endpoints for client‐driven queries.\n• Outcomes: +25% conversion, +30% AOV, +18% retention.",
          techStack: [
            "React.js",
            "JavaScript",
            "Dart & Flutter",
            "SQL Server",
            "Tailwind CSS",
            "Figma",
          ],
          demoLink: "https://zodiacgems.example.com",
          codeLink: "https://github.com/yourrepo/zodiacgems",
          timeline: "Jun 2024 – Oct 2024",
        },
      ],
    },
    {
      id: "framer",
      name: "Framer Motion",
      icon: "/icons/framer-motion.svg",
      level: 70,
      description: "Production-ready motion library for React",
      experience: "2+ years crafting fluid animations",
      projects: [],
    },
  ];

  // Responsive Hooks
  const [isLargerThan768] = useMediaQuery("(min-width: 768px)");
  const [isLargerThan480] = useMediaQuery("(min-width: 480px)");
  const [isLargerThan200] = useMediaQuery("(min-width: 200px)");

  // Get token values for dynamic styling
  const [orange400, orange500] = useToken("colors", [
    "orange.400",
    "orange.500",
  ]);

  // Responsive slide count
  const slidesToShow = useBreakpointValue({
    base: 1,
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4,
  });

  // Animation controls for section
  const controls = useAnimation();
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.1 }); // Decreased threshold for mobile

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  // UI State for modals
  const [selectedSkill, setSelectedSkill] = useState(null);
  const { open, onOpen, onClose } = useDisclosure();

  // New state and handlers for View All Skills modals
  const {
    open: isSkillsModalOpen,
    onOpen: onSkillsModalOpen,
    onClose: onSkillsModalClose,
  } = useDisclosure();

  const [selectedProject, setSelectedProject] = useState(null);
  const {
    open: isWorkModalOpen,
    onOpen: onWorkModalOpen,
    onClose: onWorkModalClose,
  } = useDisclosure();

  // Handler for showing skill details
  const handleShowDetail = useCallback(
    (skill) => {
      setSelectedSkill(skill);
      onOpen();
    },
    [onOpen]
  );
  // Handler for showing project details
  const handleShowProjectDetail = useCallback(
    (project) => {
      setSelectedProject(project);
      onWorkModalOpen();
    },
    [onWorkModalOpen]
  );
  // Slider reference to control programmatically
  const sliderRef = useRef(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState(null);

  // Handle slide change to track direction
  const handleBeforeChange = (current, next) => {
    setSlideDirection(next > current ? "right" : "left");
  };

  // Custom navigation handlers for better mobile experience
  const handlePrevClick = useCallback(() => {
    if (sliderRef.current) {
      sliderRef.current.slickPrev();
    }
  }, []);

  const handleNextClick = useCallback(() => {
    if (sliderRef.current) {
      sliderRef.current.slickNext();
    }
  }, []);

  // Animation variants with enhanced mobile animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const headingVariants = {
    hidden: { opacity: 0, y: -20, x: isLargerThan768 ? -30 : 0 },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 80, // Lowered for more natural feel
        damping: 20,
        duration: 0.8,
      },
    },
  };

  const illustrationVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 70,
        damping: 15,
        delay: 0.3,
        duration: 0.8,
      },
    },
  };

  const navButtonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { delay: 0.5, duration: 0.3 },
    },
    hover: {
      scale: 1.1,
      transition: { duration: 0.2 },
    },
    tap: {
      scale: 0.95,
      transition: { duration: 0.1 },
    },
  };

  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { delay: 0.6, duration: 0.5 },
    },
    hover: {
      scale: 1.05,
      transition: { duration: 0.2 },
    },
    tap: {
      scale: 0.95,
      transition: { duration: 0.1 },
    },
  };

  // Enhanced carousel settings with better mobile interaction
  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: slidesToShow,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    pauseOnHover: true,
    initialSlide: 0,
    beforeChange: handleBeforeChange,
    afterChange: setCurrentSlide,
    swipeToSlide: true,
    draggable: true,
    cssEase: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    arrows: isLargerThan768,
    responsive: [
      {
        breakpoint: 1280,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 2, // Đảm bảo chỉ hiển thị 1 card trên tablet
          slidesToScroll: 1,
          arrows: false,
        },
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 1, // Chỉ hiển thị 1 card trên mobile
          slidesToScroll: 1,
          arrows: false,
          autoplay: false,
          centerMode: true, // Căn giữa card trên mobile
          centerPadding: "10px", // Khoảng cách hai bên để card không sát lề
        },
      },
    ],
    appendDots: (dots) => (
      <AnimatedPagination
        dots={dots}
        currentSlide={currentSlide}
        slideDirection={slideDirection}
        hideDirectionIndicator={isLargerThan200 ? true : false}
      />
    ),
    customPaging: (i) => (
      <Box
        sx={{
          width: "18px",
          height: "18px",
          margin: "0 4px", // Tăng khoảng cách giữa các dots
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
        }}
      >
        <Box
          sx={{
            width: isLargerThan480 ? "8px" : "6px",
            height: isLargerThan480 ? "8px" : "6px",
            borderRadius: "50%",
            backgroundColor:
              i === currentSlide ? orange400 : "rgba(255, 255, 255, 0.3)",
            transition: "all 0.3s ease",
            "&:hover": {
              backgroundColor: orange500,
            },
          }}
        />
      </Box>
    ),
  };

  // Memoize the skill cards to prevent unnecessary re-renders
  const skillCards = useMemo(
    () =>
      skills.map((skill) => (
        <Suspense
          key={skill.id}
          fallback={
            <Box
              px={2}
              py={4}
              height={{ base: "250px", md: "270px" }} // Giữ kích thước tương ứng
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="gray.100"
              borderRadius="md"
            >
              <Text color="gray.400">Loading...</Text>
            </Box>
          }
        >
          <Box px={2} py={4}>
            <SkillCard skill={skill} onShowDetail={handleShowDetail} />
          </Box>
        </Suspense>
      )),
    [skills, handleShowDetail]
  );

  return (
    <Box
      as="section"
      py={{ base: 10, md: 16 }}
      id="core-skills"
      position="relative"
      overflow="hidden"
      ref={sectionRef}
    >
      {/* Background Image with enhanced Overlay and Parallax Effect */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        zIndex={-1}
        as={motion.div}
        animate={{
          y: inView ? [20, 0] : 0,
        }}
        transition={{ duration: 1.5 }}
      >
        <Box
          as="img"
          src={backgroundImage}
          alt="Background"
          width="100%"
          height="100%"
          objectFit="cover"
          objectPosition="center"
          sx={{
            filter: "brightness(0.7)",
          }}
        />
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.800"
          backdropFilter="blur(3px)" // Enhanced blur effect
          sx={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.7) 100%)",
          }}
        />
      </Box>

      <Container maxW="container.xl" position="relative" zIndex={1}>
        {/* Section heading with animation */}
        <Flex
          direction={{ base: "column", lg: "row" }}
          align={{ base: "center", lg: "flex-start" }}
          justify="space-between"
          mb={{ base: 6, md: 10 }}
        >
          <motion.div
            variants={headingVariants}
            initial="hidden"
            animate={controls}
            style={{ width: "100%" }}
          >
            <Box maxW={{ base: "100%", lg: "60%" }}>
              <Flex
                align="center"
                mb={2}
                flexWrap="wrap"
                justify={{ base: "center", lg: "flex-start" }}
              >
                <Heading
                  as="h2"
                  fontSize={{ base: "3xl", sm: "4xl", md: "5xl" }}
                  color="orange.400"
                  textAlign={{ base: "center", lg: "left" }}
                >
                  Core{" "}
                  <Box as="span" color="orange.500">
                    Skills
                  </Box>
                </Heading>

                <Badge
                  colorScheme="orange"
                  ml={3}
                  px={3}
                  py={1}
                  borderRadius="full"
                  textTransform="capitalize"
                  fontSize={{ base: "xs", md: "sm" }}
                  display={{ base: "none", sm: "inline-flex" }}
                  alignItems="center"
                  as={motion.div}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Professional Level
                </Badge>
              </Flex>

              <Text
                fontSize={{ base: "lg", md: "xl" }}
                mb={5}
                maxW="3xl"
                color="white"
                textShadow="0 2px 4px rgba(0,0,0,0.4)"
                textAlign={{ base: "center", lg: "left" }}
                lineHeight={1.6}
              >
                Proven expertise in leveraging diverse technologies and
                frameworks, acquired through extensive involvement in real-world
                projects and successful implementation in production settings
              </Text>

              {/* View All Skills button for desktop */}
              <Box display={{ base: "none", lg: "block" }} mt={4}>
                <motion.div
                  variants={buttonVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                  whileTap="tap"
                >
                  <Button
                    bg="orange.500"
                    color="white"
                    px={6}
                    py={3}
                    borderRadius="full"
                    fontWeight="semibold"
                    boxShadow="md"
                    onClick={onSkillsModalOpen}
                    _hover={{ bg: "orange.600" }}
                    _active={{ bg: "orange.700" }}
                  >
                    View All Skills
                  </Button>
                </motion.div>
              </Box>
            </Box>
          </motion.div>

          <motion.div
            variants={illustrationVariants}
            initial="hidden"
            animate={controls}
          >
            <Box
              maxW={{ base: "180px", sm: "200px", md: "250px" }}
              mt={{ base: 4, lg: 0 }}
              mx={{ base: "auto", lg: 0 }}
              position={{ lg: "relative" }}
              right={{ lg: "-20px" }}
              display={{ base: "none", md: "none", lg: "block" }} // Hide on very small screens
              as={motion.div}
              whileHover={{
                y: -5,
                transition: { duration: 0.3 },
              }}
            >
              <img
                src={illustrationImage}
                alt="Service illustration"
                style={{
                  width: "100%",
                  height: "auto",
                  objectFit: "contain",
                  filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))",
                }}
              />
            </Box>
          </motion.div>
        </Flex>

        {/* Custom Navigation for Mobile - FIXED to show icons properly */}
        {!isLargerThan768 && (
          <Flex justify="center" mb={4} display={{ base: "flex", md: "none" }}>
            <motion.div
              variants={navButtonVariants}
              initial="hidden"
              animate="visible"
              whileHover="hover"
              whileTap="tap"
            >
              <Box
                as="button"
                onClick={handlePrevClick}
                aria-label="Previous skill"
                bg="orange.400"
                borderRadius="full"
                w="40px" // Kích thước button
                h="40px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                mr={3}
                _hover={{ bg: "orange.500" }}
                _active={{ bg: "orange.600" }}
                transition="background-color 0.2s ease"
              >
                <ArrowBackIosNewIcon
                  sx={{
                    color: "white", // Màu trắng cho icon
                    fontSize: "20px", // Kích thước icon
                  }}
                />
              </Box>
            </motion.div>

            <motion.div
              variants={navButtonVariants}
              initial="hidden"
              animate="visible"
              whileHover="hover"
              whileTap="tap"
            >
              <Box
                as="button"
                onClick={handleNextClick}
                aria-label="Next skill"
                bg="orange.400"
                borderRadius="full"
                w="40px"
                h="40px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                _hover={{ bg: "orange.500" }}
                _active={{ bg: "orange.600" }}
                transition="background-color 0.2s ease"
              >
                <ArrowForwardIosIcon
                  sx={{
                    color: "white", // Màu trắng cho icon
                    fontSize: "20px", // Kích thước icon
                  }}
                />
              </Box>
            </motion.div>
          </Flex>
        )}

        {/* Carousel for skills with animation */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={controls}
        >
          <Box
            className="skills-carousel"
            px={{ base: 0, md: 4 }}
            sx={{
              ".slick-track": {
                display: "flex",
                alignItems: "stretch",
                "& > div": {
                  height: "100%",
                },
              },
              ".slick-list": {
                overflow: { base: "hidden", md: "visible" },
                cursor: "grab",
                borderRadius: { base: "16px", md: 0 },
                "&:active": {
                  cursor: "grabbing",
                },
                margin: { base: "0 10px", md: 0 }, // Tăng margin trên mobile để card không sát lề
              },
              ".slick-slide": {
                padding: { base: "0 8px", md: "0 12px" }, // Thêm padding để tạo khoảng cách giữa các card
              },
              ".slick-dots": {
                bottom: { base: "-40px", md: "-40px" }, // Đẩy dots xuống dưới để không che card
              },
              ".slick-arrow": {
                zIndex: 10,
                width: { base: "30px", md: "40px" },
                height: { base: "30px", md: "40px" },
                "&:before": {
                  color: "orange.500",
                  fontSize: { base: "20px", md: "24px" },
                },
                "&:focus": {
                  outline: "2px solid orange",
                  outlineOffset: "2px",
                },
              },
              ".slick-prev": {
                left: { base: "-5px", md: "-15px" },
              },
              ".slick-next": {
                right: { base: "-5px", md: "-15px" },
              },
              "& .slick-active .progress-dot": {
                backgroundColor: "orange.500",
                transform: "scale(1.2)",
              },
            }}
          >
            <Slider ref={sliderRef} {...sliderSettings}>
              {skillCards}
            </Slider>
          </Box>

          {/* Current Skill Counter (Mobile Only) */}
          <Box
            display={{ base: "flex", md: "none" }}
            justifyContent="center"
            mt={2}
            color="whiteAlpha.700"
            fontSize="sm"
          >
            <Text
              as={motion.p}
              animate={{ opacity: [0.5, 1] }}
              transition={{ duration: 0.3 }}
            >
              {currentSlide + 1} of {skills.length}
            </Text>
          </Box>
        </motion.div>

        {/* Call to action - Mobile & Tablet view */}
        <Box
          mt={{ base: 12, md: 16 }}
          textAlign="center"
          display={{ base: "block", lg: "none" }}
          as={motion.div}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <Text
            fontSize={{ base: "md", sm: "lg" }}
            fontWeight="medium"
            color="orange.300"
            mb={3}
          >
            Explore more of my technical expertise
          </Text>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Box
              as="button"
              bg="orange.500"
              color="white"
              px={6}
              py={3}
              borderRadius="full"
              fontWeight="semibold"
              boxShadow="md"
              onClick={onSkillsModalOpen}
              _hover={{ bg: "orange.600" }}
              _active={{ bg: "orange.700" }}
            >
              View All Skills
            </Box>
          </motion.div>
        </Box>

        {/* Lazy-loaded Detail Modal */}
        <SkillDetailModal
          skill={selectedSkill}
          isOpen={open}
          onClose={onClose}
          onShowProjectDetail={handleShowProjectDetail}
        />

        {/* Lazy-loaded WorkDetailModal */}
        <WorkDetailModal
          project={selectedProject}
          isOpen={isWorkModalOpen}
          onClose={onWorkModalClose}
        />

        {/* Skills modals - conditionally rendered based on screen size */}
        <Suspense fallback={null}>
          {isLargerThan768 ? (
            <WebSkillsModal
              isOpen={isSkillsModalOpen}
              onClose={onSkillsModalClose}
              skills={skills}
            />
          ) : (
            isSkillsModalOpen && (
              <MobileSkillsView onClose={onSkillsModalClose} skills={skills} />
            )
          )}
        </Suspense>
      </Container>
    </Box>
  );
};

export default CoreSkillsSection;
