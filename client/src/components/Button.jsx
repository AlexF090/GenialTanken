import React from 'react';

function Button({ myFunction, buttonTitle }) {
  return <button onClick={myFunction}>{buttonTitle}</button>;
}

export default Button;
