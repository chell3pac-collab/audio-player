import { mount } from 'redom';
import './styles/main.scss';
import { App } from './components/App';

const root = document.getElementById('app');
if (root) {
  mount(root, new App());
}
