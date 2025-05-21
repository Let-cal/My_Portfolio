import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import CertificationsVsActivitiesTabs from "./components/pages/CertificationsVsActivities/CertificationsVsActivitiesTabs";
import CoreSkillsSection from "./components/pages/CoreSkills/CoreSkillsSection";
import MyWorkExperienceSection from "./components/pages/ExperienceSection/MyWorkExperienceSection";
import HeroSection from "./components/pages/HeroSection/HeroSection";
import WhyHireMeSection from "./components/pages/WhyHireMe/WhyHireMeSection";

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// src/data/projects.js
// eslint-disable-next-line react-refresh/only-export-components
export const projects = [
  {
    title: "Vegetable Shop Management System",
    role: "Intern - Business Analyst",
    image: "/images/fpt_japan.jpg",
    summary:
      "Designed workflows for farmers to submit produce orders and shop owners to process and track them.",
    description:
      "• Requirement Analysis & Current State Assessment: Gathered and clarified stakeholder requirements; performed contextual and problem‐space analysis. Developed comprehensive risk assessments and gap analyses to prioritize features and define project scope.\n" +
      "• Solution Design & Project Planning: Mapped out end-to-end implementation steps—from business analysis and interface sketches to development environment setup. Established clear milestones and deliverables; evaluated multiple technological and process‐optimization options, delivering recommendation reports that weighed pros and cons.\n" +
      "• Comprehensive System Design:\n" +
      "    - Data Modeling: Created ERDs, enforced normalization, designed privacy/security controls.\n" +
      "    - Architecture: Defined client–server & microservices patterns; selected stacks and deployment strategies.\n" +
      "    - User Flows: Mapped actors/permissions, drew sequence diagrams for logic flows.\n" +
      "    - Data Visualization: Designed interactive KPI dashboards for real-time insights.\n" +
      "• Presentation & Alignment: Delivered feasibility presentations and live demos; incorporated feedback rapidly to secure consensus.\n" +
      "• Outcomes: Reduced analysis time by 20%, achieved 100% user‐story clarity, and earned a 95% satisfaction rating from stakeholders.",
    techStack: ["Figma", "draw.io", "Canva", "Visual Paradigm"],
    timeline: "Mar 2024 – Apr 2024",
  },
  {
    title: "SitePlus Commercial Consulting System",
    role: "Front-End Developer",
    summary:
      "Cooperated with SitePlus to create an internal site/space consulting system for company employees, to help brands find ideal spaces according to their business needs using AI.",
    description:
      "• Analysis & Planning: Requirements gathering, risk/gap assessments, evaluation criteria setup.\n" +
      "• System & Data Design: Modular back‐end, ERD models, real‐time dashboards, privacy controls.\n" +
      "• UX/UI Leadership: Wireframes & high‐fi Figma mocks for approval workflows and POS integrations.\n" +
      "• Collaboration: Feedback loops with stakeholders to keep delivery on schedule.\n" +
      "• Features: Automated survey tasks, contract & revenue modules, SignalR notifications.\n" +
      "• Outcomes: 30% error reduction, 25% throughput increase, 95% stakeholder satisfaction.",
    demoLink: "https://demo.siteplus.example.com",
    codeLink: "https://github.com/yourrepo/siteplus",
    techStack: [
      "React.js & TypeScript",
      "Dart & Flutter",
      "SQL Server",
      "Tailwind CSS",
      "Figma",
    ],
    timeline: "Jan 2025 – Apr 2025",
  },
  {
    title: "ZodiacGems E-commerce Platform",
    role: "Front-End Developer",
    summary:
      "Personalized jewelry recommendations via zodiac compatibility & Feng Shui rules.",
    description:
      "• Architecture & Leadership: System design, team mentoring, agile ceremonies.\n" +
      "• Recommendation Engine: Rule-based mapping of zodiac & elemental affinities.\n" +
      "• UI/UX: Smart filters, zodiac-themed visuals, seamless checkout flows in Figma.\n" +
      "• API & Data Modeling: MongoDB catalogs, GraphQL endpoints for client‐driven queries.\n" +
      "• Outcomes: +25% conversion, +30% AOV, +18% retention.",
    demoLink: "https://zodiacgems.example.com",
    codeLink: "https://github.com/yourrepo/zodiacgems",
    techStack: [
      "React.js",
      "JavaScript",
      "Dart & Flutter",
      "SQL Server",
      "Tailwind CSS",
      "Figma",
    ],
    timeline: "Jun 2024 – Oct 2024",
  },
  {
    title: "Meet My Lecturer",
    role: "Full-Stack Developer",
    summary:
      "Web-based scheduler syncing with Google Calendar & Meet, real-time notifications.",
    description:
      "• Engine & Real-time: Socket.io infrastructure, two-way Google Calendar integration.\n" +
      "• UX/UI: Figma booking flows optimized for desktop & mobile.\n" +
      "• Dashboards: MongoDB aggregations for session metrics, analytics UI.\n" +
      "• Outcomes: +40% utilization, −70% admin overhead, 4.8/5 satisfaction.",
    demoLink: "https://meetmylecturer.example.com",
    codeLink: "https://github.com/yourrepo/meet-my-lecturer",
    techStack: [
      "Java Servlet",
      "SQL Server",
      "Google Calendar API",
      "Socket.io",
      "Figma",
    ],
    timeline: "Jul 2023 – Nov 2023",
  },
];

export const Certificates = [
  {
    name: "Japanese Language Proficiency Test (JLPT) – Level N3",
    issueDate: "2024-12-01",
    expirationDate: null,
    organization: "Japan Foundation",
    credentialId: "JLPT-N3-2024",
    credentialUrl: "https://www.jlpt.jp/e/",
    skills: [
      "Reading Comprehension",
      "Listening & Conversation",
      "Cultural Fluency",
    ],
    description:
      "Fluent in reading complex business emails and technical docs, actively contributing to meetings and sprint reviews in Japanese, and adept at Japanese-style project management. Proven during my FPT Japan internship to bridge language gaps, streamline communication, and accelerate delivery.",
  },
  {
    name: "CertNexus Certified Ethical Emerging Technologist Professional Certificate",
    issueDate: "2023-09-12",
    expirationDate: null,
    organization: "CertNexus",
    credentialId: "Z9XWVWFLHVSX",
    credentialUrl:
      "https://coursera.org/share/d30d57400d67418e8573cfcf80165b74",
    skills: [
      "Ethical Tech",
      "Framework Operationalization",
      "Risk Mitigation",
      "Ethical Communication",
      "Data Ethics Leadership",
    ],
    description:
      "Validates the ability to identify and address ethical issues in emerging technologies, ensuring responsible and sustainable development practices in innovative tech environments.",
  },
  {
    name: "Software Development Lifecycle Specialization",
    issueDate: "2023-05-16",
    expirationDate: null,
    organization: "University of Minnesota",
    credentialId: "UF4U7APZEZD2",
    credentialUrl:
      "https://coursera.org/share/1a913ee30f90b25413e36ddd02f06db9",
    skills: [
      "Software Development",
      "Agile Methodologies",
      "Project Management",
    ],
    description:
      "Covers the entire software development lifecycle, from requirements gathering to deployment, with a strong emphasis on agile methodologies and efficient project management.",
  },
  {
    name: "Web Design for Everybody: Basics of Web Development & Coding Specialization",
    issueDate: "2023-02-06",
    expirationDate: null,
    organization: "University of Michigan",
    credentialId: "SFQFBTGTYU3B",
    credentialUrl:
      "https://coursera.org/share/7db6d4b982b2a79910548d414e7240c6",
    skills: [
      "HTML5",
      "CSS3",
      "JavaScript",
      "Advanced Styling with Responsive Design",
      "Web Design for Everybody Capstone",
    ],
    description:
      "Provides a comprehensive introduction to web development, covering HTML, CSS, JavaScript, and responsive design principles to create user-friendly websites.",
  },
  {
    name: "Computer Communications Specialization",
    issueDate: "2022-09-23",
    expirationDate: null,
    organization: "University of Colorado System",
    credentialId: "4FNLNT8AY6V7",
    credentialUrl:
      "https://coursera.org/share/09e0cf48c02eac4d8b02617da51689cf",
    skills: [
      "Fundamentals of Network Communication",
      "Peer-to-Peer Protocols and Local Area Networks",
      "Packet Switching Networks and Algorithms",
      "TCP/IP",
    ],
    description:
      "Explores the fundamentals of computer networking, including protocols, security measures, and communication technologies essential for modern IT infrastructure.",
  },
  {
    name: "Project Management Principles and Practices",
    issueDate: "2024-05-13",
    expirationDate: null,
    organization: "University of California, Irvine",
    credentialId: "LUYMLLYA474P",
    credentialUrl:
      "https://www.coursera.org/account/accomplishments/specialization/LUYMLLYA474P",
    skills: [
      "Project Initiation",
      "Project Planning",
      "Project Execution",
      "Project Closure",
    ],
    description:
      "Fundamental principles of project management, covering initiation, planning, execution, monitoring, and closure phases.",
  },
  {
    name: "User Experience Research and Design",
    issueDate: "2024-09-19",
    expirationDate: null,
    organization: "University of Michigan",
    credentialId: "I03NH1TMEVV8",
    credentialUrl:
      "https://www.coursera.org/account/accomplishments/specialization/I03NH1TMEVV8",
    skills: [
      "User Research",
      "Wireframing & Prototyping",
      "Usability Testing",
      "Interaction Design",
    ],
    description:
      "Techniques for conducting user research, creating wireframes/prototypes, and validating design decisions through usability testing.",
  },
  {
    name: "Academic English: Writing",
    issueDate: "2024-01-14",
    expirationDate: null,
    organization: "University of California, Irvine",
    credentialId: "QKRJRFHFT8ZA",
    credentialUrl:
      "https://www.coursera.org/account/accomplishments/specialization/QKRJRFHFT8ZA",
    skills: [
      "Academic Essay Writing",
      "Research Documentation",
      "Argument Development",
      "Editing & Proofreading",
    ],
    description:
      "Focused on developing clear, well-structured academic essays and research papers in English, with an emphasis on argumentation and editing skills.",
  },
  {
    name: "Entrepreneurship: Launching an Innovative Business",
    issueDate: "2024-06-04",
    expirationDate: null,
    organization: "University of Maryland, College Park",
    credentialId: "QFF6J76HEPZF",
    credentialUrl:
      "https://www.coursera.org/account/accomplishments/specialization/QFF6J76HEPZF",
    skills: [
      "Opportunity Identification",
      "Business Model Creation",
      "Pitch Development",
      "Startup Financing",
    ],
    description:
      "Covers ideation, business model design, pitch creation, and financing strategies for launching innovative ventures.",
  },
  {
    name: "Academic Skills for University Success",
    issueDate: "2022-06-27",
    expirationDate: null,
    organization: "The University of Sydney",
    credentialId: "DVP6AL4ME98R",
    credentialUrl:
      "https://www.coursera.org/account/accomplishments/specialization/DVP6AL4ME98",
    skills: [
      "Time Management",
      "Critical Thinking",
      "Academic Research",
      "Collaborative Learning",
    ],
    description:
      "Essential academic skills for success in university settings, including study strategies, research methods, and teamwork.",
  },
];

export const Activities = [
  {
    name: "Soft Skills Leader, Communication & In-Group Working Skills (SSG104)",
    date: "2022-09-01",
    skills: ["Leadership", "Communication", "Teamwork"],
    description:
      "Led workshops on teamwork and leadership practices from September 2022 to November 2022, fostering a collaborative environment and enhancing group dynamics.",
  },
  {
    name: "Bau Bang High School Basketball Club",
    date: "2020-01-01",
    skills: ["Teamwork", "Discipline", "Physical Fitness"],
    description:
      "Join the basketball club for 2 years (2020-2022), represent the school in provincial tournaments, practice teamwork skills and discipline.",
  },
  {
    name: "Cultural activities",
    date: "2019-06-01",
    skills: ["Public Speaking", "Creativity", "Performance"],
    description:
      "Participate in a variety of cultural activities such as singing and acting, developing public speaking skills and creativity.",
  },
];

const Home = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize page animations after initial render
  useEffect(() => {
    // Allow time for components to mount before running animations
    const timer = setTimeout(() => {
      setIsLoaded(true);
      initPageAnimations();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Set up scroll-triggered animations
  const initPageAnimations = () => {
    // Animate core skills section
    animateSectionEntrance("#core-skills");

    // Animate projects section
    animateSectionEntrance("#projects");

    // Animate certificates section
    animateSectionEntrance("#certificates");

    // Animate why hire me section
    animateSectionEntrance("#why-hire-me");
  };

  // Reusable function to animate section entrance
  const animateSectionEntrance = (selector) => {
    const section = document.querySelector(selector);
    if (!section) return;

    // Animate section title
    gsap.fromTo(
      `${selector} h2`,
      { y: 50, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: selector,
          start: "top 80%",
          toggleActions: "play none none none",
        },
      }
    );

    // Animate section content
    gsap.fromTo(
      `${selector} > div > *:not(h2)`,
      { y: 50, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.15,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: selector,
          start: "top 70%",
          toggleActions: "play none none none",
        },
      }
    );
  };

  return (
    <>
      <Layout>
        {/* Adding IDs to each section for scroll targeting */}
        <div id="home">
          <HeroSection />
        </div>

        <div
          id="core-skills"
          className={`scroll-section ${isLoaded ? "loaded" : ""}`}
        >
          <CoreSkillsSection />
        </div>

        <div
          id="projects"
          className={`scroll-section ${isLoaded ? "loaded" : ""}`}
        >
          <MyWorkExperienceSection projects={projects} />
        </div>

        <div
          id="why-hire-me"
          className={`scroll-section ${isLoaded ? "loaded" : ""}`}
        >
          <WhyHireMeSection />
        </div>

        <div
          id="certificates"
          className={`scroll-section ${isLoaded ? "loaded" : ""}`}
        >
          <CertificationsVsActivitiesTabs
            certifications={Certificates}
            activities={Activities}
            showPageCounter={true}
          />
        </div>
      </Layout>
    </>
  );
};

export default Home;
