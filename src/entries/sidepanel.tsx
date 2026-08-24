import { render } from "preact";

import { ResearchWorkbench } from "../shell/ResearchWorkbench";
import "../shell/styles.css";

render(<ResearchWorkbench surface="sidepanel" />, document.getElementById("app")!);
