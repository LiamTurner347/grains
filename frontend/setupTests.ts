import "@testing-library/jest-dom";

import { MotionGlobalConfig } from "framer-motion";

// Disable all Framer Motion animations in tests
MotionGlobalConfig.skipAnimations = true;
