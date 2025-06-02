# Chatbot Component

## Purpose
Interactive chat interface for generating motion animations from text prompts. Provides the main user interaction point for AI-powered motion generation.

## Props
```typescript
interface ChatbotProps {
  onFileReceived: (filename: string) => void;
  onSend: () => void;
  onAvatarUpdate: () => void;
}
```

## Key Features
- **Dynamic Text Fields**: Add/remove prompt input fields
- **Text-to-Motion Generation**: Convert natural language to BVH animations
- **Audio File Upload**: Integration with FileUploadButton for audio-driven motion
- **Avatar Creation**: Generate GLB models from user specifications
- **Loading States**: Visual feedback during API processing

## API Integration

### Text-to-Motion
**Endpoint**: `https://handy-lamb-enough.ngrok.app/generate-motion`
```typescript
const payload = {
  text_prompt: texts,           // Array of text prompts
  motion_length: -1,           // Auto-determine length
  repeat_times: 1,             // Single generation
  gpu_id: 0,                   // GPU selection
  seed: 1,                     // Reproducibility
  ext: "generation_fast"       // Generation mode
};
```

### Avatar Generation
Calls `handleAvatarGeneration()` from `create_glb.tsx` to generate custom avatars based on user measurements.

## State Management
```typescript
const [texts, setTexts] = useState<string[]>([""]);
const [isLoading, setIsLoading] = useState(false);
```

## User Interactions

### Adding/Removing Prompts
- **Add Field**: Plus button creates new text input
- **Remove Field**: X button removes specific field
- **Minimum**: Always maintains at least one input field

### Generation Process
1. User enters text prompts
2. Clicks "Send to generate motion"
3. Loading state activated
4. API call with all prompts
5. BVH filename returned
6. `onFileReceived` callback triggered

## Dependencies
- **Internal**: `Input`, `Button`, `FileUploadButton`, `create_glb`
- **External**: `axios`, `lucide-react`

## Usage Example
```tsx
<Chatbot 
  onFileReceived={(filename) => setBvhFile(filename)}
  onSend={() => setGenerating(true)}
  onAvatarUpdate={() => refreshAvatars()}
/>
```

## Styling
- Modern chat interface design
- Responsive layout with Tailwind CSS
- Icon buttons for intuitive interaction
- Loading animations for feedback 