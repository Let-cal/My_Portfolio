import CloseIcon from "@mui/icons-material/Close";
import { IconButton, Box as MuiBox, Stack, Typography } from "@mui/material";
import PropTypes from "prop-types";

export default function DetailModal({
  onClose,
  title,
  icon,
  description,
  additionalContent,
  footerContent,
}) {
  return (
    <MuiBox
      onClick={(e) => e.stopPropagation()}
      sx={{
        backgroundColor: "#1A202C",
        color: "white",
        borderRadius: 2,
        boxShadow: "0 10px 40px rgba(255,165,0,0.3)",
        border: "1px solid rgba(255,165,0,0.4)",
        width: "100%",
        maxWidth: 600,
        maxHeight: 600, // Chuyển maxHeight từ SkillDetailModal sang đây
        zIndex: "10000",
        display: "flex", // Sử dụng flex để quản lý layout
        flexDirection: "column", // Xếp theo cột: header, body, footer
      }}
    >
      {/* Header */}
      <MuiBox
        sx={{
          display: "flex",
          alignItems: "center",
          px: 3,
          py: 2,
          background: "linear-gradient(90deg,#FF8C00 0%,#FFA500 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          flexShrink: 0, // Không để header bị co lại
        }}
      >
        {icon && (
          <MuiBox
            sx={{
              width: 48,
              height: 48,
              mr: 2,
              p: 1,
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.2)",
              backdropFilter: "blur(4px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            <img
              src={icon}
              alt={title}
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
              }}
            />
          </MuiBox>
        )}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: "white",
            flexGrow: 1,
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}
        >
          {title}
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            color: "white",
            backgroundColor: "rgba(0,0,0,0.2)",
            "&:hover": { backgroundColor: "rgba(0,0,0,0.4)" },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </MuiBox>

      {/* Body */}
      <MuiBox
        sx={{
          px: 3,
          py: 2,
          flexGrow: 1, // Phần body chiếm không gian còn lại
          overflowY: "auto", // Cho phép cuộn nếu nội dung dài
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "rgba(255,165,0,0.3)",
            borderRadius: 3,
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: "rgba(255,255,255,0.1)",
          },
        }}
      >
        <Stack spacing={4}>
          {description && (
            <Typography
              variant="body1"
              sx={{
                fontStyle: "italic",
                color: "rgba(255,255,255,0.7)",
                borderLeft: "3px solid #FFA500",
                pl: 2,
                py: 1,
                whiteSpace: "pre-wrap",
              }}
            >
              {description}
            </Typography>
          )}
          {additionalContent}
        </Stack>
      </MuiBox>

      {/* Footer */}
      {footerContent && (
        <MuiBox
          sx={{
            p: 2,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(0,0,0,0.2)",
            width: "100%",
            flexShrink: 0, // Không để footer bị co lại
          }}
        >
          {footerContent}
        </MuiBox>
      )}
    </MuiBox>
  );
}

DetailModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  icon: PropTypes.string,
  description: PropTypes.string,
  additionalContent: PropTypes.node,
  footerContent: PropTypes.node,
};
