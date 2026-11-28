// questionTypes/index.js
import { SS } from "./ss.jsx";
import { MS } from "./ms.jsx";
import { FI } from "./fill.jsx";
const WR = { ...FI, label: "写作" };

export const questionTypes = { SS, MS, FI, WR };