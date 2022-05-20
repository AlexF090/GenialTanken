import React from "react";
import Button from './Button.jsx';


export default {
  title: 'components/Button',
  component: Button,
};

const Template = args => <Button {...args} />;

export const Default = Template.bind({});
Default.args = {
  buttonTitle: 'Speichern',
};

