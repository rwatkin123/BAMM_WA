# BAMM Components Documentation

## Overview
This documentation provides comprehensive coverage of the BAMM (Body Avatar Motion Model) web application components. The application uses React, Next.js, and Three.js to create an interactive 3D avatar motion generation and visualization platform.

## Documentation Structure

### 📁 Core Documentation
- **[Pipeline Overview](./pipeline.md)** - Complete data flow and architecture
- **[Motion Retargeting](./retargeting.md)** - Deep dive into skeleton animation transfer
- **[Components](./components/)** - Individual component documentation

### 🧩 Component Categories

#### Main Application Components
- **[Chatbot](./components/Chatbot.md)** - Text prompt motion generation interface
- **[Canvas](./components/Canvas.md)** - Main 3D viewport for motion visualization  
- **[ThreeCanvas](./components/ThreeCanvas.md)** - Background 3D scene with character showcase
- **[FileUploadButton](./components/FileUploadButton.md)** - Audio file upload with motion generation
- **[create_glb](./components/create_glb.md)** - GLB model creation and export utilities

#### Interface Components
- **[AvatarGrid](./components/AvatarGrid.md)** - Avatar thumbnail grid display
- **[SidebarNav](./components/SidebarNav.md)** - Main navigation sidebar
- **[ImportPanel](./components/ImportPanel.md)** - File import interface
- **[ExportPanel](./components/ExportPanel.md)** - Export functionality panel
- **[MeasurementControls](./components/MeasurementControls.md)** - Body measurement controls
- **[FilenameList](./components/FilenameList.md)** - File selection dropdown
- **[LazyImage](./components/LazyImage.md)** - Performance-optimized image loading

#### UI Components
- **[Button](./components/ui/button.md)** - Reusable button component
- **[Card](./components/ui/card.md)** - Container components
- **[Input](./components/ui/input.md)** - Text input component
- **[Label](./components/ui/label.md)** - Form label component
- **[Slider](./components/ui/slider.md)** - Range input slider
- **[Tabs](./components/ui/tabs.md)** - Tabbed interface components

## Quick Start

### Understanding the System
1. **Read [Pipeline Overview](./pipeline.md)** - Understand data flow
2. **Study [Motion Retargeting](./retargeting.md)** - Core animation process
3. **Browse component docs** - Implementation details

### Key Concepts
- **BVH Files**: Motion capture data for animations
- **GLB Models**: 3D avatar models with skeletons
- **SMPL Standard**: 55-bone humanoid skeleton structure
- **Motion Retargeting**: Transferring animations between characters

### Architecture
```
User Input → AI Processing → Motion Data → 3D Visualization
     ↓              ↓             ↓            ↓
  Chatbot     Text/Audio API    BVH Files    Canvas
```

## Development Guidelines

### Adding New Components
1. Create component file in appropriate directory
2. Add documentation file in `docs/components/`
3. Update this README with component link
4. Follow established TypeScript patterns

### Documentation Standards
- **Purpose**: Clear component description
- **Props**: TypeScript interface definitions  
- **Features**: Key capabilities and behaviors
- **Dependencies**: External and internal dependencies
- **Usage**: Code examples and integration patterns

### Performance Considerations
- Use React.memo for expensive components
- Implement proper Three.js resource disposal
- Optimize texture loading and caching
- Use intersection observers for lazy loading

## External Dependencies

### Core Libraries
- **React 18+**: Component framework
- **Next.js 13+**: Full-stack framework
- **Three.js**: 3D graphics and WebGL
- **@radix-ui**: Accessible UI primitives
- **lucide-react**: Icon library
- **axios**: HTTP client
- **class-variance-authority**: Variant management

### Build Tools
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first styling
- **ESLint**: Code linting
- **Prettier**: Code formatting

## API Endpoints

### Motion Generation
- **Text-to-Motion**: `https://handy-lamb-enough.ngrok.app/generate-motion`
- **Audio-to-Motion**: `https://audio-motion.ngrok.app/generate-motion/`

### File Management
- **File Listing**: `/api/listfile`
- **File Upload**: `/api/upload`

## Contributing

### Code Style
- Use TypeScript for all components
- Follow Tailwind CSS utility classes
- Implement proper error handling
- Add comprehensive JSDoc comments

### Testing
- Test component rendering
- Verify Three.js resource cleanup
- Check accessibility compliance
- Validate API integrations

---

*For detailed implementation information, refer to the individual component documentation files and source code comments.* 