import React from "react";
import GlobalStyles from "../src/GlobalStyles.jsx";
    import { addDecorator } from "@storybook/react";
    import { MemoryRouter } from "react-router";
    
    addDecorator(story => <MemoryRouter initialEntries={['/']}><GlobalStyles />{story()}</MemoryRouter>);

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
}