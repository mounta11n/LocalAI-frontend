import React, { useState, useRef, useEffect, Fragment } from "react";
import "./index.css";

const host = "http://localhost:8080";

const ChatGptInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [models, setModels] = useState([]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(50);
  const [topP, setTopP] = useState(1);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState("");
  const [triggerWords, setTriggerWords] = useState({ user: "", assistant: "" });
  const chatContainerRef = useRef(null);
  

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleSubmit = async () => {
    // Add user input to messages
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", content: input },
    ]);

    // Reset error state and set loading state
    setError(null);
    setIsLoading(true);

    try {
      const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            ...messages,
            {
              role: "user",
              content: triggerWords.user + input + triggerWords.assistant,
            },
          ],
          temperature: parseFloat(temperature),
          max_tokens: parseInt(maxTokens, 10),
          top_p: parseFloat(topP),
          stream: true,
        }),
      };

      console.log("Request:", requestOptions); 
      const response = await fetch(`${host}/v1/chat/completions`, requestOptions);

      // let data = "";
      const reader = response.body.getReader();
      let partialData = "";
      let done = false;
      let assistantResponse = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();

        done = readerDone;

        if (value) {
          const chunk = new TextDecoder().decode(value);
          partialData += chunk;
          const lines = partialData.split("\n");

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];
            if (line.startsWith("data: ")) {
              const jsonStr = line.substring("data: ".length);
              if (jsonStr.trim() !== "[DONE]") {
                const json = JSON.parse(jsonStr);
          
                // Check if the response contains choices and delta fields
                if (json.choices && json.choices.length > 0 && json.choices[0].delta) {
                  const token = json.choices[0].delta.content;
                  if (token !== undefined) {
                    assistantResponse += token;
                    setCurrentAssistantMessage(assistantResponse);
                  }
                }
              } else {
                done = true;
              }
            }
          }

          partialData = lines[lines.length - 1];
        }
      }
      
      const initialPrompt = {
        "Vicuna V1": "A chat between a curious user and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the user's questions.",
        "Alpaca": "Below is an instruction that describes a task. Write a response that appropriately completes the request."
      };
      
      if (messages.length === 0 && initialPrompt[selectedModel]) {
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: "assistant", content: initialPrompt[selectedModel] },
        ]);
      }

      // Add assistant response to messages
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "assistant", content: assistantResponse },
      ]);

      // Clear input field and currentAssistantMessage
      setInput("");
        setCurrentAssistantMessage("");
      } catch (error) {
        console.error("Error:", error);
        setError("Failed to fetch response. Please try again: " + error.message);
      } finally {
        setIsLoading(false);
        setInput("");
      }
    };

  const fetchModelsUsingCurl = async () => {
    const response = await fetch("http://localhost:8080/v1/models");
    const data = await response.json();
    console.log("Fetched models:", data?.data); 
    return data?.data || [];
  };
  
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const models = await fetchModelsUsingCurl();
        console.log("Setting models:", models);
        setModels(models);
      } catch (error) {
        console.error("Error:", error);
      }
    };
    fetchModels();
  }, []);

  const handleModelChange = (e) => {
    setSelectedModel(e.target.value);
  };

  const [selectedModel, setSelectedModel] = useState("");

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentAssistantMessage]);

  const renderMessageContent = (content) => {
    const parts = content.split("\n");
    return parts.map((part, index) => (
      <Fragment key={index}>
        {part}
        {index < parts.length - 1 && <br />}
      </Fragment>
    ));
  };

  const triggerLayouts = [
    {
      displayText: "Alpaca            | ### Instruction: ... ### Response:",
      userTrigger: "### Instruction:\n",
      assistantTrigger: "\n\n### Response: ",
    },
    {
      displayText:  "GPT4 x Vicuna    | ### Instruction: ... ### Response:",
      userTrigger: "### Instruction:\n",
      assistantTrigger: "\n\n### Response: ",
    },
    {
      displayText: "Guanaco QLoRA     | ### Human: ... ### Assistant:",
      userTrigger: "### Human: ",
      assistantTrigger: "\n\n### Assistant: " ,
    },
    {
      displayText: "Vicuna V 0         | ### Human: ... ### Assistant:",
      userTrigger: "### Human: ",
      assistantTrigger: "\n### Assistant: ",
    },
    {
      displayText: "Vicuna V 1         | USER: ... ASSISTANT:",
      userTrigger: "USER: ",
      assistantTrigger: "\nASSISTANT: ",
    },
    {
      displayText:  "WizardLM 7B      | ... ### Response:",
      userTrigger: "",
      assistantTrigger: "\n\n### Response: ",
    },
    {
      displayText:  "WizardLM 13B 1.0 | USER: ... ASSISTANT:",
      userTrigger: "USER: ",
      assistantTrigger: "ASSISTANT: ",
    },
    // Füge hier weitere Modelle hinzu...
  ];

  return (
    <div className="chat-page">
      <div className="sidebar"></div>
      <div className="chat-container" ref={chatContainerRef}>
        <div className="chat-messages">
          {/* Render user input and chatbot responses */}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`chat-message ${
                message.role === "user" ? "user-message" : "assistant-message"
              }`}
            >
              <span className="message-role">
                {message.role === "user" ? "You" : "LocalAI"}:
              </span>
              <span className="message-content">
                {renderMessageContent(message.content)}
              </span>
            </div>
          ))}
          {isLoading && (
            <div className="chat-message assistant-message">
              <span className="message-role">LocalAI:</span>
              <span className="message-content">
                {renderMessageContent(currentAssistantMessage)}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="sidebar">
        <h3>Settings</h3>
        <label htmlFor="temperature">Temperature</label>
        <input
          className="custom-select"
          type="number"
          id="temperature"
          name="temperature"
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
        />
          <br />
          <label htmlFor="maxTokens">Max Tokens</label>
          <input
          className="custom-select"
            type="number"
            id="maxTokens"
            name="maxTokens"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
        />
        <br />
        <label htmlFor="topP">Top P</label>
        <input
          className="custom-select"
          type="number"
          id="topP"
          name="topP"
          value={topP}
          onChange={(e) => setTopP(e.target.value)}
        />
      </div>
            {/* Neuer Wrapper-Container für die Steuerelemente */}
            <div className="controls-wrapper">
      <div className="chat-input">
      {/* Container für Dropdown-Menüs, Input und Switches */}
      <div className="controls-container">
        {/* Container für die beiden Dropdown-Menüs */}
        <div className="dropdowns-container">
          {/* Render dropdown list for models */}
      <div className="model-dropdown">
      {console.log("Rendering models:", models)}
      <select
        value={selectedModel}
        onChange={handleModelChange}
        disabled={isLoading}
      >
        <option value="">Select Model</option>
        {models.map((model, index) => (
          <option key={index} value={model.id}>
            {model.id}
          </option>
        ))}
      </select>
    </div>
    <div className="trigger-dropdown">
    {console.log("Rendering models:", triggerWords)}
    <select
  className="custom-select"
  value={triggerWords.user + triggerWords.assistant}
  onChange={(e) => {
    const selectedOption = e.target.value;
    const layout = triggerLayouts.find(
      (layout) => layout.userTrigger + layout.assistantTrigger === selectedOption
    );
    if (layout) {
      setTriggerWords({ user: layout.userTrigger, assistant: layout.assistantTrigger });
    }
  }}
  disabled={isLoading}
>
  <option value="">Select Prompt Template</option>
  {triggerLayouts.map((layout, index) => (
    <option key={index} value={layout.userTrigger + layout.assistantTrigger}>
      {layout.displayText}
    </option>
  ))}
</select>
      </div>
      </div>
      </div>
        {/* Container für User Input und Submit Button */}
        <div className="input-container">
          {/* Render input field and submit button */}
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          className="input-field"
          placeholder="Enter your message..."
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        <button
          onClick={handleSubmit}
          className="submit-button"
          disabled={!input || isLoading}
        >
          {isLoading ? "..." : ">"}
        </button>
      </div>
      </div>
      {/* Container für die Switches */}
      {/* <div className="switch-buttons">
      <div class="switches-container">
        <button className="switch-button">Switch 1</button>
        <button className="switch-button">Switch 2</button>
        <button className="switch-button">Switch 3</button>
      </div> */}
      {/* Render error message if there's an error */}
      {error && <div className="error-message">{error}</div>}
    </div>
    </div>

  );
};

export default ChatGptInterface;
