export default defineAppConfig({
  pages: [
    'pages/inspiration/index',
    'pages/causality/index',
    'pages/endings/index'
  ],
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#1C1C2E',
    navigationBarTitleText: '噩灵感官',
    navigationBarTextStyle: 'white',
    backgroundColor: '#1C1C2E'
  },
  tabBar: {
    color: '#78788A',
    selectedColor: '#9B59B6',
    backgroundColor: '#252540',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/inspiration/index',
        text: '灵感速记'
      },
      {
        pagePath: 'pages/causality/index',
        text: '因果检查'
      },
      {
        pagePath: 'pages/endings/index',
        text: '结局卡册'
      }
    ]
  }
})
