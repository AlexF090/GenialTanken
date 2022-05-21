import NavBar from './NavBar.jsx';

export default {
  title: 'components/NavBar',
  component: NavBar,
  argTypes: {},
};

const Template = args => <NavBar {...args} />;

export const Default = Template.bind({});
Default.args = {};