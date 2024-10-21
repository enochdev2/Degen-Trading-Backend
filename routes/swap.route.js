import express from "express";
import {  swapsolana, swapothers } from "../controllers/index.js";

const router = express.Router();

router.post("/swapsol", swapsolana);
router.post("/swapothers", swapothers);

export default router;
