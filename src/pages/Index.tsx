import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Lightbulb, Building2, Zap, Shield, BarChart3, Globe } from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const features = [
  {
    icon: Lightbulb,
    title: "Submit & Showcase Ideas",
    description: "Present your innovations with rich media, funding details, and IP status to the right audience.",
  },
  {
    icon: Building2,
    title: "Company Innovation Filters",
    description: "Set precise criteria — industry, stage, TRL level — and let matching ideas come to you.",
  },
  {
    icon: Zap,
    title: "Smart Matching Engine",
    description: "AI-powered scoring ranks ideas against company needs with weighted match percentages.",
  },
  {
    icon: Globe,
    title: "Idestrim Integration",
    description: "Import ideas directly from Idestrim with a shared link. One click, zero friction.",
  },
  {
    icon: BarChart3,
    title: "Real-time Insights",
    description: "Track idea performance, match rates, and engagement metrics on your dashboard.",
  },
  {
    icon: Shield,
    title: "Secure & Role-Based",
    description: "Enterprise-grade security with role-based access for innovators and companies.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="container flex items-center justify-between h-16 px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-display font-bold text-foreground">Idemark</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-hero min-h-[90vh] flex items-center overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/10 blur-3xl animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

        <div className="container relative z-10 px-6 py-32">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            initial="hidden"
            animate="visible"
          >
            <motion.div
              custom={0}
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary-foreground/80 text-sm mb-8"
            >
              <Zap className="w-3.5 h-3.5" />
              The Innovation Marketplace
            </motion.div>

            <motion.h1
              custom={1}
              variants={fadeUp}
              className="text-5xl md:text-7xl font-display font-bold text-primary-foreground leading-[1.1] mb-6"
            >
              Where Innovation
              <br />
              <span className="text-gradient">Meets Industry</span>
            </motion.h1>

            <motion.p
              custom={2}
              variants={fadeUp}
              className="text-lg md:text-xl text-primary-foreground/60 max-w-xl mx-auto mb-10"
            >
              Connect groundbreaking ideas with the companies ready to invest.
              Intelligent matching. Structured discovery. Real results.
            </motion.p>

            <motion.div custom={3} variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="text-base px-8 h-12" asChild>
                <Link to="/signup">
                  Start as Innovator
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 h-12 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <Link to="/signup">Join as Company</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-background">
        <div className="container px-6">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Built for the Innovation Economy
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Everything innovators and companies need to discover, evaluate, and connect — in one platform.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="p-6 rounded-xl bg-card border border-border card-glow group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 bg-secondary/50">
        <div className="container px-6">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              How Idemark Works
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Three simple steps to connect innovation with opportunity.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "01", title: "Choose Your Role", desc: "Sign up as an innovator to submit ideas, or as a company to discover them." },
              { step: "02", title: "Set Up Your Profile", desc: "Innovators submit ideas. Companies define their innovation filter criteria." },
              { step: "03", title: "Get Matched", desc: "Our engine scores and ranks matches. Connect when both sides are ready." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="text-center"
              >
                <div className="text-5xl font-display font-bold text-primary/20 mb-4">{item.step}</div>
                <h3 className="text-xl font-display font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-hero">
        <div className="container px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground mb-4">
              Ready to Bridge the Innovation Gap?
            </h2>
            <p className="text-primary-foreground/60 text-lg mb-8 max-w-xl mx-auto">
              Join Idemark today and be part of the structured innovation marketplace.
            </p>
            <Button size="lg" className="text-base px-8 h-12" asChild>
              <Link to="/signup">
                Get Started Free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-card border-t border-border">
        <div className="container px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">Idemark</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Idemark. Where Innovation Meets Industry.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
