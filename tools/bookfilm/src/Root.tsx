import React from "react";
import { Composition } from "remotion";
import { BookFilm, BookFilmProps } from "./BookFilm";

const sample: BookFilmProps = {
  title: "The Ramayana", author: "R. K. Narayan", hall: "The Hall of Gods",
  line: "Rama, Sita, Hanuman and the long road to Lanka, told in one evening.",
  characters: [
    { name: "Rama", role: "The prince", image: "rama.jpg" },
    { name: "Hanuman", role: "The son of the wind", image: "hanuman.jpg" },
    { name: "Sita", role: "The princess", image: "sita.jpg" },
  ],
};

export const RemotionRoot: React.FC = () => (
  <Composition id="BookFilm" component={BookFilm} durationInFrames={240} fps={30} width={1280} height={574}
    defaultProps={sample} />
);
