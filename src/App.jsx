import { Box, Typography, AppBar, Toolbar } from '@mui/material'
import LocationOnIcon from '@mui/icons-material/LocationOn'

function App() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <LocationOnIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="h1">
            Location Based Service
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Typography variant="body1" color="text.secondary">
          Karte wird hier angezeigt
        </Typography>
      </Box>
    </Box>
  )
}

export default App
