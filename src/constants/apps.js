export const CAPS_APPS = [
  { 
    id: '1', 
    name: 'CAPS Attendance', 
    desc: 'Attendance tracking', 
    image: require('../../assets/images/caps_ams.png'),
    color: '#3B82F6',
    isDraft: true
  },
  { 
    id: '2', 
    name: 'CAPS Content', 
    desc: 'Content creation & management', 
    image: require('../../assets/images/caps_content.png'), 
    color: '#10B981',
    isDraft: true
  },
  { 
    id: '3', 
    name: 'CAPS Service', 
    desc: 'Service request & management', 
    image: require('../../assets/images/caps_service.png'), 
    color: '#F59E0B',
    isDraft: true
  },
  {
    id: '4',
    name: 'CAPS Report',
    desc: 'Reporting & analytics',
    image: require('../../assets/images/caps_logo.png'),
    color: '#EF4444',
    isDraft: false,
    redirectTo: "Reports"
  }
];