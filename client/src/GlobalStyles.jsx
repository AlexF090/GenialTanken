import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  }

  html, body {
    height: 100%;
    width: 100%;
}

  body {
    display: flex;
    flex-direction: column;
}
`;

export default GlobalStyle;
