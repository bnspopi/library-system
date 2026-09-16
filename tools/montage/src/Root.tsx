import React from "react";
import { Composition } from "remotion";
import { Montage, MontageProps } from "./Montage";
import plan from "../artifacts/scene_plan.json";

const shots = plan.shots as MontageProps["shots"];
const timing = plan.timing as MontageProps["timing"];
/* intro, then one step per plate, then the last plate's tail, then the credit */
const duration =
  timing.intro + (shots.length - 1) * timing.step + timing.shot - timing.overlap + timing.outro;

const defaults: MontageProps = {
  title: "Plates from the Gallery",
  subtitle: "Six stills, held and moved.",
  repo: "github.com/freestylefly/awesome-gpt-image-2",
  shots,
  timing,
};

export const RemotionRoot: React.FC = () => (
  <Composition id="Montage" component={Montage} durationInFrames={duration}
    fps={plan.format.fps} width={plan.format.width} height={plan.format.height}
    defaultProps={defaults} />
);
