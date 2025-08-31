const Hero: React.FC = () => {
  return (
    <section id="home" className="min-h-screen flex items-center justify-center pt-20 section">
      <div className="container mx-auto px-6 py-12 text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          Hi, I'm <span className="gradient-text">Deepankar BhadrasenOP IN THE CHAT</span>
        </h1>
        <h2 className="text-2xl md:text-3xl text-gray-300 mb-8">AI Automation Specialist</h2>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12">
          Transforming businesses through intelligent automation and n8n workflows
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <a href="#workflows" className="btn bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-full font-medium clickable">
            View My Work
          </a>
          <a href="#contact" className="btn bg-transparent border border-indigo-500 text-indigo-400 hover:text-indigo-300 px-8 py-3 rounded-full font-medium clickable">
            Get In Touch
          </a>
        </div>
      </div>
    </section>
  );
};

export default Hero;
