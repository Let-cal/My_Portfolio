import { AnimatePresence, motion } from "framer-motion";
import PropTypes from "prop-types";
import { lazy, Suspense } from "react";
import DetailModal from "../../ui/detail_modal";

const ProjectCard = lazy(() => import("./ProjectCard"));

// ✨ Animation variants vẫn ở đây ✨
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { delay: 0.2, duration: 0.3 } },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 25, delay: 0.1 },
  },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.2 } },
};

const contentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 500, damping: 30 },
  },
};

export default function SkillDetailModal({
  skill,
  isOpen,
  onClose,
  onShowProjectDetail,
}) {
  if (!skill) return null;

  const additionalContent = (
    <motion.div variants={contentVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants}>
        <p
          style={{
            fontStyle: "italic",
            color: "rgba(255,255,255,0.7)",
            marginBottom: 16,
            borderLeft: "3px solid #FFA500",
            paddingLeft: 8,
          }}
        >
          {skill.description}
        </p>
      </motion.div>
      <motion.div variants={itemVariants}>
        <h4 style={{ color: "#FFA500", marginBottom: 8 }}>Kinh nghiệm:</h4>
        <div
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          {skill.experience}
        </div>
      </motion.div>
      <motion.div variants={itemVariants}>
        <h4 style={{ color: "#FFA500", marginBottom: 8 }}>Dự án liên quan:</h4>
        <Suspense fallback={<div style={{ color: "#999" }}>Đang tải...</div>}>
          {skill.projects.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
              style={{ marginBottom: 16 }}
            >
              <ProjectCard project={p} onClick={onShowProjectDetail} />
            </motion.div>
          ))}
        </Suspense>
      </motion.div>
    </motion.div>
  );

  const footerContent = (
    <button
      onClick={onClose}
      style={{
        backgroundColor: "rgba(255,165,0,0.2)",
        color: "#FFA500",
        border: "none",
        padding: "8px 16px",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      Close
    </button>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={onClose}
        >
          <motion.div
            key="modal-content"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ width: "100%", maxWidth: 600 }} // Loại bỏ maxHeight và layoutScroll
            onClick={(e) => e.stopPropagation()}
          >
            <DetailModal
              onClose={onClose}
              title={skill.name}
              icon={skill.icon}
              additionalContent={additionalContent}
              footerContent={footerContent}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

SkillDetailModal.propTypes = {
  skill: PropTypes.shape({
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
    description: PropTypes.string.isRequired,
    experience: PropTypes.string.isRequired,
    projects: PropTypes.array.isRequired,
  }).isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onShowProjectDetail: PropTypes.func.isRequired,
};
