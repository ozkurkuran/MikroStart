import { render } from "preact";

import { ResearchWorkbench } from "../shell/ResearchWorkbench";
import "../shell/styles.css";

render(<ResearchWorkbench surface="dashboard" />, document.getElementById("app")!);
